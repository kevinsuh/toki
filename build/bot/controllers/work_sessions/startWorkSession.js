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
		var intent = _intents2.default.START_SESSION;

		var config = {
			intent: intent,
			SlackUserId: SlackUserId
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('new_session_group_decision', [bot, config]);
		}, 1000);
	});

	/**
  * 				EVERY CREATED SESSION GOES THROUGH THIS FIRST
  *   		*** this checks if there is an existing open session ***
  *   			if no open sessions => `begin_session`
  *   			else => go through this flow
  */
	controller.on('confirm_new_session', function (bot, config) {

		/**
   * 		User can either:
   * 			1. Keep going
   * 			2. Start new session by ending this one early
   * 					- update endTime in session to now
   * 					- mark it as done and re-enter `begin_session`
   */

		var SlackUserId = config.SlackUserId;

		console.log("\n\n\n\n\nin `confirm_new_session` before entering begin_session flow!\n\n\n\n\n");

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			user.getWorkSessions({
				where: ['"open" = ?', true]
			}).then(function (workSessions) {
				var tz = user.SlackUser.tz;

				// no open work sessions => you're good to go!

				if (workSessions.length == 0) {
					controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId }]);
					return;
				}

				// otherwise, we gotta confirm user wants to cancel current work session

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					// by default, user wants to start a new session
					// that's why she is in this flow...
					// no openWorkSession unless we found one
					convo.startNewSession = true;
					convo.openWorkSession = false;

					var openWorkSession = workSessions[0]; // deal with first one as reference point
					convo.openWorkSession = openWorkSession;

					var endTime = (0, _momentTimezone2.default)(openWorkSession.endTime).tz(tz);
					var endTimeString = endTime.format("h:mm a");
					var now = (0, _momentTimezone2.default)();
					var minutesLeft = Math.round(_momentTimezone2.default.duration(endTime.diff(now)).asMinutes());

					convo.say('You are already in a session until *' + endTimeString + '*! You have ' + minutesLeft + ' minutes left :timer_clock:');
					convo.ask('Do you want to `keep going`, or cancel it and start a `new session`?', function (response, convo) {

						var responseMessage = response.text;
						var entities = response.intentObject.entities;


						var newSession = new RegExp(/(((^st[tart]*))|(^ne[ew]*)|(^se[ession]*))/); // `start` or `new`
						var keepGoing = new RegExp(/(((^k[ep]*))|(^go[oing]*))/); // `keep` or `going`

						if (newSession.test(responseMessage)) {

							// start new session
							convo.say("Sounds good :facepunch:");
						} else if (keepGoing.test(responseMessage)) {

							// continue current session
							convo.say("Got it. Let's do it! :weight_lifter:");
							convo.say('I\'ll ping you at ' + endTimeString + ' :alarm_clock:');
							convo.startNewSession = false;
						} else {

							// invalid
							convo.say("I'm sorry, I didn't catch that :dog:");
							convo.repeat();
						}
						convo.next();
					});

					convo.on('end', function (convo) {

						console.log("\n\n\n ~~ here in end of confirm_new_session ~~ \n\n\n");

						var startNewSession = convo.startNewSession;
						var openWorkSession = convo.openWorkSession;

						// if user wants to start new session, then do this flow and enter `begin_session` flow

						if (startNewSession) {

							/**
        * 		~ User has confirmed starting a new session ~
        * 			* end current work session early
        * 			* cancel all existing open work sessions
        * 			* cancel `break` reminders
        */

							var now = (0, _momentTimezone2.default)();

							// if user had an open work session(s), cancel them!
							if (openWorkSession) {
								openWorkSession.update({
									endTime: now,
									open: false
								});
								workSessions.forEach(function (workSession) {
									workSession.update({
										open: false
									});
								});
							};

							// cancel all user breaks cause user is RDY TO WORK
							_models2.default.User.find({
								where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
								include: [_models2.default.SlackUser]
							}).then(function (user) {
								user.getReminders({
									where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break"]]
								}).then(function (reminders) {
									reminders.forEach(function (reminder) {
										reminder.update({
											"open": false
										});
									});
								});
							});

							controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId }]);
						}
					});
				});
			});
		});
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
					tz: tz
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
					} else {
						// entry point of thy conversation
						(0, _startWorkSessionFunctions.startSessionStartConversation)(err, convo);
					}
				});

				// on finish convo
				convo.on('end', function (convo) {

					var responses = convo.extractResponses();
					var sessionStart = convo.sessionStart;
					var SlackUserId = sessionStart.SlackUserId;
					var confirmStart = sessionStart.confirmStart;

					// proxy that some odd bug has happened
					// impossible to have 1+ daily tasks and no time estimate

					if (sessionStart.dailyTasks.length > 0 && !sessionStart.calculatedTimeObject) {

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say("Sorry but something went wrong :dog:. Please try `start a session` again");
							convo.next();
						});
						return;
					}

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

						// if user wanted a checkin reminder

						if (checkinTimeObject) {
							_models2.default.Reminder.create({
								remindTime: checkinTimeObject,
								UserId: UserId,
								customNote: reminderNote,
								type: "work_session"
							});
						}

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

						_models2.default.WorkSession.create({
							startTime: startTime,
							endTime: endTime,
							UserId: UserId
						}).then(function (workSession) {
							workSession.setDailyTasks(dailyTaskIds);

							// if new task, insert that into DB and attach to work session
							if (newTask) {
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

						var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(tasksToWorkOnArray);

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say('See you at *' + calculatedTime + '!* :timer_clock:');
							convo.say('Good luck with: \n' + taskListMessage);
							convo.next();
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
											convo.say("Hey! You actually don't have any tasks right now. Let's get things to work on first");
										}

										convo.next();

										convo.on('end', function (convo) {
											// go to start your day from here
											var config = { SlackUserId: SlackUserId };
											var startNewDay = convo.startNewDay;


											if (startNewDay) {
												controller.trigger('begin_day_flow', [bot, config]);
											} else {
												controller.trigger('add_task_flow', [bot, config]);
											}
										});
									});
								});
							})();
						} else {
							// default premature end!
							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
								convo.say("Okay! Exiting now. Let me know when you want to start on a session");
								convo.next();
							});
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

var _startWorkSessionFunctions = require('./startWorkSessionFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=startWorkSession.js.map