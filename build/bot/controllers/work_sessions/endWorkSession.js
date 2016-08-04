'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		/**
   * 			check if user has open session (should only be one)
   * 					if yes, trigger finish and end_session flow
   * 			  	if no, reply with confusion & other options
   */

		var SlackUserId = message.user;
		var doneSessionEarly = true;

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(function () {
			if (_botResponses.utterances.containsTaskOrPriority.test(message.text)) {
				// want to finish off some tasks
				controller.trigger('edit_plan_flow', [bot, { SlackUserId: SlackUserId }]);
			} else {
				controller.trigger('done_session_flow', [bot, { SlackUserId: SlackUserId, doneSessionEarly: doneSessionEarly }]);
			}
		}, 800);
	});

	/**
  * 		User has confirmed to ending session
  * 		This will immediately close the session, then move to
  * 		specified "post session" options
  */
	controller.on('done_session_flow', function (bot, config) {

		// you can pass in a storedWorkSession
		var SlackUserId = config.SlackUserId;
		var storedWorkSession = config.storedWorkSession;
		var sessionTimerUp = config.sessionTimerUp;
		var doneSessionEarly = config.doneSessionEarly;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			var tz = user.SlackUser.tz;
			var defaultBreakTime = user.defaultBreakTime;
			var defaultSnoozeTime = user.defaultSnoozeTime;

			var UserId = user.id;

			user.getWorkSessions({
				where: ['"open" = ?', true],
				order: '"WorkSession"."createdAt" DESC',
				include: [_models2.default.DailyTask]
			}).then(function (workSessions) {

				var workSession = storedWorkSession || workSessions[0];

				if (workSession) {

					// only update endTime if it is less than current endTime
					var now = (0, _momentTimezone2.default)();

					var _moment = (0, _momentTimezone2.default)(workSession.dataValues.endTime);

					var endTime = _moment.endTime;

					if (now < endTime) endTime = now;

					workSession.update({
						open: false,
						endTime: now
					}).then(function (workSession) {

						var startTime = (0, _momentTimezone2.default)(workSession.startTime).tz(tz);
						var endTime = (0, _momentTimezone2.default)(workSession.endTime).tz(tz);
						var endTimeString = endTime.format("h:mm a");
						var workSessionMinutes = Math.round(_momentTimezone2.default.duration(endTime.diff(startTime)).asMinutes());
						var workSessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(workSessionMinutes);

						workSession.getStoredWorkSession({
							where: ['"StoredWorkSession"."live" = ?', true]
						}).then(function (storedWorkSession) {

							var dailyTaskIds = workSession.DailyTasks.map(function (dailyTask) {
								return dailyTask.id;
							});

							user.getDailyTasks({
								where: ['"DailyTask"."id" IN (?)', dailyTaskIds],
								include: [_models2.default.Task]
							}).then(function (dailyTasks) {

								if (dailyTasks.length > 0) {

									var dailyTask = dailyTasks[0]; // one task per session

									// do our math update to daily task here
									var minutesSpent = dailyTask.minutesSpent;
									minutesSpent += workSessionMinutes;
									dailyTask.update({
										minutesSpent: minutesSpent
									}).then(function (dailyTask) {

										bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

											convo.sessionDone = {
												UserId: UserId,
												SlackUserId: SlackUserId,
												defaultBreakTime: defaultBreakTime,
												defaultSnoozeTime: defaultSnoozeTime,
												tz: tz,
												dailyTask: dailyTask,
												doneSessionEarly: doneSessionEarly,
												sessionTimerUp: sessionTimerUp,
												reminders: [],
												currentSession: {
													startTime: startTime,
													endTime: endTime,
													workSessionMinutes: workSessionMinutes,
													workSessionTimeString: workSessionTimeString,
													dailyTask: dailyTask
												}
											};

											if (storedWorkSession) {
												workSessionMinutes = storedWorkSession.dataValues.minutes;
												workSessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(workSessionMinutes);
												// currently paused
												convo.doneSessionEarly.currentSession.isPaused = true;
												convo.doneSessionEarly.currentSession.workSessionTimeString = workSessionTimeString;
											}

											(0, _endWorkSessionFunctions.doneSessionAskOptions)(convo);

											convo.on('end', function (convo) {
												var _convo$sessionDone = convo.sessionDone;
												var SlackUserId = _convo$sessionDone.SlackUserId;
												var dailyTask = _convo$sessionDone.dailyTask;


												console.log("\n\n\n session is done!");
												console.log(convo.sessionDone);
												console.log("\n\n\n");

												(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
											});
										});
									});
								}
							});
						});
					});
				} else {

					// want to be end a session when they arent currently in one
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.ask('You aren\'t in a session right now! Would you like to start one?', [{
							pattern: _botResponses.utterances.yes,
							callback: function callback(response, convo) {
								convo.startSession = true;
								convo.next();
							}
						}, {
							pattern: _botResponses.utterances.no,
							callback: function callback(response, convo) {
								convo.say('Okay! I\'ll be here when you\'re ready to crank again :wrench: ');
								convo.next();
							}
						}, {
							default: true,
							callback: function callback(response, convo) {
								convo.say("Sorry, I didn't get that. Please tell me `yes` or `no` to the question!");
								convo.repeat();
								convo.next();
							}
						}]);
						convo.next();
						convo.on('end', function (convo) {
							if (convo.startSession) {
								controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId }]);
							} else {
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
							}
						});
					});
				}
			});
		});
	});

	/**
  * 			~~ SESSION_TIMER FUNCTIONALITIES ~~
  */

	// session timer triggered by cron-job
	controller.on('session_timer_up', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var workSession = config.workSession;

		var sessionTimerUp = true;
		var doneSessionEarly = false;

		var dailyTaskIds = workSession.DailyTasks.map(function (dailyTask) {
			return dailyTask.id;
		});

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;

			if (workSession) {

				// only update endTime if it is less than current endTime
				var now = (0, _momentTimezone2.default)();

				var _moment2 = (0, _momentTimezone2.default)(workSession.dataValues.endTime);

				var endTime = _moment2.endTime;

				if (now < endTime) endTime = now;

				workSession.update({
					open: false,
					endTime: endTime
				}).then(function (workSession) {
					var tz = user.SlackUser.tz;
					var defaultSnoozeTime = user.defaultSnoozeTime;
					var defaultBreakTime = user.defaultBreakTime;

					var startTime = (0, _momentTimezone2.default)(workSession.startTime).tz(tz);
					var endTime = (0, _momentTimezone2.default)(workSession.endTime).tz(tz);
					var endTimeString = endTime.format("h:mm a");
					var workSessionMinutes = Math.round(_momentTimezone2.default.duration(endTime.diff(startTime)).asMinutes());
					var workSessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(workSessionMinutes);

					user.getDailyTasks({
						where: ['"DailyTask"."id" IN (?) AND "Task"."done" = ?', dailyTaskIds, false],
						include: [_models2.default.Task]
					}).then(function (dailyTasks) {

						if (dailyTasks.length > 0) {

							// cancel all old reminders
							user.getReminders({
								where: ['"open" = ? AND "type" IN (?)', true, ["work_session", "break", "done_session_snooze"]]
							}).then(function (oldReminders) {
								oldReminders.forEach(function (reminder) {
									reminder.update({
										"open": false
									});
								});
							});

							var dailyTask = dailyTasks[0]; // one task per session

							// do our math update to daily task here
							var minutesSpent = dailyTask.minutesSpent;
							minutesSpent += workSessionMinutes;
							dailyTask.update({
								minutesSpent: minutesSpent
							}).then(function (dailyTask) {

								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

									convo.sessionDone = {
										UserId: UserId,
										SlackUserId: SlackUserId,
										defaultBreakTime: defaultBreakTime,
										defaultSnoozeTime: defaultSnoozeTime,
										tz: tz,
										dailyTask: dailyTask,
										sessionTimerUp: sessionTimerUp,
										doneSessionEarly: doneSessionEarly,
										reminders: [],
										currentSession: {
											startTime: startTime,
											endTime: endTime,
											workSessionMinutes: workSessionMinutes,
											workSessionTimeString: workSessionTimeString,
											dailyTask: dailyTask
										}
									};

									(0, _endWorkSessionFunctions.doneSessionAskOptions)(convo);

									convo.on('end', function (convo) {
										var _convo$sessionDone2 = convo.sessionDone;
										var SlackUserId = _convo$sessionDone2.SlackUserId;
										var dailyTask = _convo$sessionDone2.dailyTask;


										console.log("\n\n\n session is done!");
										console.log(convo.sessionDone);
										console.log("\n\n\n");
									});
								});
							});
						}
					});
				});
			}
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _botResponses = require('../../lib/botResponses');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

var _endWorkSessionFunctions = require('../modules/endWorkSessionFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=endWorkSession.js.map