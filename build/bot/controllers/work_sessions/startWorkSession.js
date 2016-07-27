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

		var intent = _intents2.default.START_SESSION;

		var config = {
			intent: intent,
			SlackUserId: SlackUserId,
			taskDecision: _constants.TASK_DECISION.work.word,
			message: message
		};
		config.taskDecision = _constants.TASK_DECISION.work.word;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		var taskNumbers = (0, _messageHelpers.convertStringToNumbersArray)(text);
		if (taskNumbers) {
			// if task numbers, we'll try and get single line task to work on
			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {

				var UserId = user.id;

				user.getDailyTasks({
					where: ['"DailyTask"."type" = ?', "live"],
					include: [_models2.default.Task],
					order: '"Task"."done", "DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					var dailyTasksToWorkOn = [];
					dailyTasks.forEach(function (dailyTask, index) {
						var priority = dailyTask.dataValues.priority;

						if (taskNumbers.indexOf(priority) > -1) {
							dailyTasksToWorkOn.push(dailyTask);
						}
					});
					if (dailyTasksToWorkOn.length > 0) {
						config.dailyTasksToWorkOn = dailyTasksToWorkOn;
					}
					config.taskNumbers = taskNumbers;
					controller.trigger('edit_tasks_flow', [bot, config]);
				});
			});
		} else {
			setTimeout(function () {
				controller.trigger('edit_tasks_flow', [bot, config]);
			}, 1000);
		}
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
		var dailyTasksToWorkOn = config.dailyTasksToWorkOn;

		console.log("\n\n\n\n\nin `confirm_new_session` before entering begin_session flow!\n\n\n\n\n");

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var now = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss Z");
			user.getWorkSessions({
				where: ['"open" = ? AND "endTime" > ?', true, now]
			}).then(function (workSessions) {
				var tz = user.SlackUser.tz;

				// no live work sessions => you're good to go!

				if (workSessions.length == 0) {
					controller.trigger('begin_session', [bot, config]);
					return;
				}
				var liveWorkSession = workSessions[0];
				liveWorkSession.getDailyTasks({
					include: [_models2.default.Task]
				}).then(function (dailyTasks) {

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						// by default, user wants to start a new session
						// that's why she is in this flow...
						// no liveWorkSession unless we found one
						convo.startNewSession = true;
						convo.liveWorkSession = false;

						var liveWorkSession = workSessions[0]; // deal with first one as reference point

						convo.liveWorkSession = liveWorkSession;

						var endTime = (0, _momentTimezone2.default)(liveWorkSession.endTime).tz(tz);
						var endTimeString = endTime.format("h:mm a");
						var now = (0, _momentTimezone2.default)();
						var minutesLeft = Math.round(_momentTimezone2.default.duration(endTime.diff(now)).asMinutes());
						var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutesLeft);

						var taskTexts = dailyTasks.map(function (dailyTask) {
							return dailyTask.dataValues.Task.text;
						});
						var tasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTexts);

						var newSessionTasks = dailyTasksToWorkOn;
						var newSessionMessage = "Do you want to cancel this session and start your new one?";
						if (newSessionTasks && newSessionTasks.length > 0) {
							var newSessionTaskTexts = newSessionTasks.map(function (dailyTask) {
								return dailyTask.dataValues.Task.text;
							});
							var newSessionTasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(newSessionTaskTexts);
							newSessionMessage = 'Do you want to cancel this session and work on ' + newSessionTasksString + ' instead?';
						}

						convo.say('You are already in a session for ' + tasksString + ' until *' + endTimeString + '*! You have *' + minutesString + '* left :timer_clock:');
						convo.ask(newSessionMessage, [{
							pattern: _botResponses.utterances.yes,
							callback: function callback(response, convo) {
								// start new session
								convo.say("Sounds good :facepunch:");
								convo.next();
							}
						}, {
							pattern: _botResponses.utterances.containsCancel,
							callback: function callback(response, convo) {
								// start new session
								convo.say("Sounds good :facepunch:");
								convo.next();
							}
						}, {
							pattern: _botResponses.utterances.no,
							callback: function callback(response, convo) {
								// continue current session
								convo.say("Got it. Let's keep this one! :weight_lifter:");
								convo.say('I\'ll ping you at *' + endTimeString + '* :timer_clock: ');
								convo.startNewSession = false;
								convo.next();
							}
						}, {
							default: true,
							callback: function callback(response, convo) {
								// invalid
								convo.say("I'm sorry, I didn't catch that. Let me know `yes` or `no`!");
								convo.repeat();
								convo.next();
							}
						}]);

						convo.on('end', function (convo) {

							console.log("\n\n\n ~~ here in end of confirm_new_session ~~ \n\n\n");

							var startNewSession = convo.startNewSession;
							var liveWorkSession = convo.liveWorkSession;

							// if user wants to start new session, then do this flow and enter `begin_session` flow

							if (startNewSession) {

								/**
         * 		~ User has confirmed starting a new session ~
         * 			* end current work session early
         * 			* cancel all existing open work sessions
         * 			* cancel `break` reminders
         */

								var now = (0, _momentTimezone2.default)();

								// if user had any live work session(s), cancel them!
								if (liveWorkSession) {
									liveWorkSession.update({
										endTime: now,
										open: false,
										live: false
									});
									workSessions.forEach(function (workSession) {
										workSession.update({
											open: false,
											live: false
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
								controller.trigger('begin_session', [bot, config]);
							} else {
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
							}
						});
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

						(0, _startWorkSessionFunctions.confirmTimeForTasks)(err, convo);
						convo.next();
					} else {

						// let's turn off sessions and reminders here
						(0, _miscHelpers.closeOldRemindersAndSessions)(user);

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

var _startWorkSessionFunctions = require('./startWorkSessionFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=startWorkSession.js.map