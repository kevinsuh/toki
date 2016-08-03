'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *
  * 		User directly asks to start a session
  * 							~* via Wit *~
  * 		     this makes sure you are properly in
  * 		     				in a "SessionGroup" before
  * 		     			working on your session
  */
	controller.hears(['start_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;
		var text = message.text;


		var config = {
			planDecision: _constants.constants.PLAN_DECISION.work.word,
			SlackUserId: SlackUserId,
			message: message
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('plan_command_center', [bot, config]);
		}, 750);
	});

	/**
  * 		ACTUAL START SESSION FLOW
  * 		this will begin the start_session flow with user
  *
  * 			- start work session
  * 			- show and decide tasks to work on
  * 			- decide session duration
  */
	controller.on('begin_session', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var dailyTasksToWorkOn = config.dailyTasksToWorkOn;


		console.log("in begin session:");
		console.log(config);
		console.log("\n\n");

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.SlackUser.tz;


			if (!tz) {
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
				});
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				var name = user.nickName || user.email;

				// configure necessary properties on convo object
				convo.name = name;

				// object that contains values important to this conversation
				// tz will be important as time goes on
				convo.sessionStart = {
					UserId: user.id,
					SlackUserId: SlackUserId,
					tasksToWorkOnHash: {},
					tz: tz,
					newTask: {}
				};

				// FIND DAILY TASKS, THEN START THE CONVERSATION
				user.getDailyTasks({
					where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
					order: '"priority" ASC',
					include: [_models2.default.Task]
				}).then(function (dailyTasks) {

					// save the daily tasks for reference
					dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
					convo.sessionStart.dailyTasks = dailyTasks;

					// user needs to enter daily tasks
					if (dailyTasks.length == 0) {
						convo.sessionStart.noDailyTasks = true;
						convo.stop();
					} else if (dailyTasksToWorkOn && dailyTasksToWorkOn.length > 0) {

						/**
       * ~~ USER HAS PASSED IN DAILY TASKS TO WORK ON FOR THIS SESSION ~~
       */
						dailyTasksToWorkOn = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasksToWorkOn, "daily");

						var tasksToWorkOnHash = {};
						dailyTasksToWorkOn.forEach(function (dailyTask, index) {
							tasksToWorkOnHash[index] = dailyTask;
						});

						convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;

						confirmTimeForTasks(err, convo);
						convo.next();
					} else {

						// let's turn off sessions and reminders here
						(0, _miscHelpers.closeOldRemindersAndSessions)(user);

						// entry point of thy conversation
						startSessionStartConversation(err, convo);
					}
				});

				// on finish convo
				convo.on('end', function (convo) {

					var responses = convo.extractResponses();
					var sessionStart = convo.sessionStart;
					var SlackUserId = sessionStart.SlackUserId;
					var confirmStart = sessionStart.confirmStart;

					var now = (0, _momentTimezone2.default)();

					if (confirmStart) {

						/**
      *    1. tell user time and tasks to work on
      *    
      *    2. save responses to DB:
      *      session:
      *        - tasks to work on (tasksToWorkOnHash)
      *        - sessionEndTime (calculated)
      *        - reminder (time + possible customNote)
      *
      *    3. start session
      */

						var UserId = sessionStart.UserId;
						var SlackUserId = sessionStart.SlackUserId;
						var dailyTasks = sessionStart.dailyTasks;
						var calculatedTime = sessionStart.calculatedTime;
						var calculatedTimeObject = sessionStart.calculatedTimeObject;
						var tasksToWorkOnHash = sessionStart.tasksToWorkOnHash;
						var checkinTimeObject = sessionStart.checkinTimeObject;
						var reminderNote = sessionStart.reminderNote;
						var newTask = sessionStart.newTask;
						var tz = sessionStart.tz;

						// cancel all user breaks cause user is RDY TO WORK

						_models2.default.User.find({
							where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
							include: [_models2.default.SlackUser]
						}).then(function (user) {

							// END ALL REMINDERS BEFORE CREATING NEW ONE
							user.getReminders({
								where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break", "done_session_snooze"]]
							}).then(function (reminders) {
								reminders.forEach(function (reminder) {
									reminder.update({
										"open": false
									});
								});
								// if user wanted a checkin reminder
								if (checkinTimeObject) {
									_models2.default.Reminder.create({
										remindTime: checkinTimeObject,
										UserId: UserId,
										customNote: reminderNote,
										type: "work_session"
									});
								}
							});

							// 1. create work session 
							// 2. attach the daily tasks to work on during that work session
							var startTime = (0, _momentTimezone2.default)();
							var endTime = calculatedTimeObject;

							// create necessary data models:
							//  array of Ids for insert, taskObjects to create taskListMessage
							var dailyTaskIds = [];
							var tasksToWorkOnArray = [];
							for (var key in tasksToWorkOnHash) {
								var task = tasksToWorkOnHash[key];
								if (task.dataValues) {
									// existing tasks
									dailyTaskIds.push(task.dataValues.id);
								}
								tasksToWorkOnArray.push(task);
							}

							// END ALL WORK SESSIONS BEFORE CREATING NEW ONE
							user.getWorkSessions({
								where: ['"live" = ?', true]
							}).then(function (workSessions) {
								workSessions.forEach(function (workSession) {
									workSession.update({
										open: false,
										live: false
									});
								});

								_models2.default.WorkSession.create({
									startTime: startTime,
									endTime: endTime,
									UserId: UserId
								}).then(function (workSession) {
									workSession.setDailyTasks(dailyTaskIds);

									// if new task, insert that into DB and attach to work session
									if (newTask.text && newTask.minutes) {
										(function () {

											var priority = dailyTasks.length + 1;
											var text = newTask.text;
											var minutes = newTask.minutes;

											_models2.default.Task.create({
												text: text
											}).then(function (task) {
												_models2.default.DailyTask.create({
													TaskId: task.id,
													priority: priority,
													minutes: minutes,
													UserId: UserId
												}).then(function (dailyTask) {
													workSession.setDailyTasks([dailyTask.id]);
												});
											});
										})();
									}
								});
							});

							/**
        * 		~~ START WORK SESSION MESSAGE ~~
        */

							var tasksToWorkOnTexts = tasksToWorkOnArray.map(function (dailyTask) {
								if (dailyTask.dataValues) {
									return dailyTask.dataValues.Task.text;
								} else {
									return dailyTask.text;
								}
							});

							var tasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(tasksToWorkOnTexts);
							var minutesDuration = Math.round(_momentTimezone2.default.duration(calculatedTimeObject.diff(now)).asMinutes());
							var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutesDuration);

							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

								convo.say('Good luck with ' + tasksString + '!');
								convo.say({
									text: 'See you in ' + timeString + ' at *' + calculatedTime + '* :timer_clock:',
									attachments: _constants.startSessionOptionsAttachments
								});

								convo.next();
							});
						});
					} else {

						// ending convo prematurely 
						if (sessionStart.noDailyTasks) {
							var fiveHoursAgo;

							(function () {

								console.log("\n\n ~~ NO DAILY TASKS ~~ \n\n");

								var task = convo.task;
								var bot = task.bot;
								var source_message = task.source_message;
								fiveHoursAgo = (0, _momentTimezone2.default)().subtract(5, 'hours').format("YYYY-MM-DD HH:mm:ss Z");


								user.getWorkSessions({
									where: ['"WorkSession"."endTime" > ?', fiveHoursAgo]
								}).then(function (workSessions) {

									// start a new day if you have not had a work session in 5 hours
									var startNewDay = workSessions.length == 0 ? true : false;
									bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

										convo.startNewDay = startNewDay;

										if (startNewDay) {
											convo.say("Hey! You haven't entered any tasks yet today. Let's start the day before doing a session :muscle:");
										} else {
											convo.say("Hey! Let's get things to work on first");
										}

										convo.next();

										convo.on('end', function (convo) {
											// go to start your day from here
											var config = { SlackUserId: SlackUserId };
											var startNewDay = convo.startNewDay;


											if (startNewDay) {
												controller.trigger('begin_day_flow', [bot, config]);
											} else {
												controller.trigger('edit_tasks_flow', [bot, config]);
											}
										});
									});
								});
							})();
						}
					}
				});
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _startWorkSessionFunctions = require('../modules/startWorkSessionFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=startWorkSession.js.map