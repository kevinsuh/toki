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
	controller.hears(['start_session', 'is_back'], 'direct_message', _index.wit.hears, function (bot, message) {
		var intent = message.intentObject.entities.intent;

		var sessionIntent = void 0;
		if (intent && intent.length > 0) {
			sessionIntent = intent[0].value;
		}

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

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

		var taskNumbers = (0, _messageHelpers.convertStringToNumbersArray)(text);
		if (taskNumbers) {
			config.taskNumbers = taskNumbers;
			controller.trigger('edit_plan_flow', [bot, config]);
		} else {
			setTimeout(function () {
				_models2.default.User.find({
					where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
					include: [_models2.default.SlackUser]
				}).then(function (user) {

					var name = user.nickName || user.email;

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						if (sessionIntent == 'is_back') {
							convo.say('Welcome back, ' + name + '!');
						} else {
							convo.say(" ");
						}
						convo.next();
						convo.on('end', function (convo) {
							// new session we'll automatically send to begin_session now
							controller.trigger('begin_session', [bot, config]);
						});
					});
				});
			}, 750);
		}
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
		var dailyTaskToWorkOn = config.dailyTaskToWorkOn;
		var currentSession = config.currentSession;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.SlackUser.tz;

			var UserId = user.id;

			if (!tz) {
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
				});
				return;
			}

			user.getDailyTasks({
				where: ['"DailyTask"."type" = ?', "live"],
				include: [_models2.default.Task],
				order: '"Task"."done", "DailyTask"."priority" ASC'
			}).then(function (dailyTasks) {

				dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					convo.sessionStart = {
						SlackUserId: SlackUserId,
						UserId: UserId,
						tz: tz,
						bot: bot,
						dailyTasks: dailyTasks
					};

					if (dailyTaskToWorkOn) {
						convo.sessionStart.dailyTask = dailyTaskToWorkOn;
					}

					// check for openWorkSession, before starting flow
					user.getWorkSessions({
						where: ['"open" = ?', true]
					}).then(function (workSessions) {

						var currentSession = false;

						if (workSessions.length > 0) {
							(function () {

								var openWorkSession = workSessions[0];
								openWorkSession.getStoredWorkSession({
									where: ['"StoredWorkSession"."live" = ?', true]
								}).then(function (storedWorkSession) {
									openWorkSession.getDailyTasks({
										include: [_models2.default.Task]
									}).then(function (dailyTasks) {

										// if there is an already open session we will store it
										// and if it is paused

										var now = (0, _momentTimezone2.default)();
										var endTime = (0, _momentTimezone2.default)(openWorkSession.endTime);
										var endTimeString = endTime.format("h:mm a");
										var minutes = Math.round(_momentTimezone2.default.duration(endTime.diff(now)).asMinutes());
										var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

										var dailyTaskTexts = dailyTasks.map(function (dailyTask) {
											return dailyTask.dataValues.Task.text;
										});

										var sessionTasks = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTexts);

										currentSession = {
											minutes: minutes,
											minutesString: minutesString,
											sessionTasks: sessionTasks,
											endTimeString: endTimeString,
											storedWorkSession: storedWorkSession
										};

										if (storedWorkSession) {
											currentSession.isPaused = true;

											minutes = Math.round(storedWorkSession.dataValues.minutes);
											minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

											currentSession.minutes = minutes;
											currentSession.minutesString = minutesString;
										}

										console.log(currentSession);

										convo.sessionStart.currentSession = currentSession;
										(0, _startWorkSessionFunctions.finalizeTimeAndTasksToStart)(convo);
										convo.next();
									});
								});
							})();
						} else {
							convo.sessionStart.currentSession = currentSession;
							(0, _startWorkSessionFunctions.finalizeTimeAndTasksToStart)(convo);
							convo.next();
						}
					});

					convo.on('end', function (convo) {
						var sessionStart = convo.sessionStart;
						var _convo$sessionStart = convo.sessionStart;
						var dailyTask = _convo$sessionStart.dailyTask;
						var completeDailyTask = _convo$sessionStart.completeDailyTask;
						var confirmStart = _convo$sessionStart.confirmStart;
						var confirmOverRideSession = _convo$sessionStart.confirmOverRideSession;
						var addMinutesToDailyTask = _convo$sessionStart.addMinutesToDailyTask;
						var endDay = _convo$sessionStart.endDay;


						console.log("\n\n\n end of start session ");
						console.log(sessionStart);
						console.log("\n\n\n");

						if (completeDailyTask) {
							// complete current priority and restart `begin_session`

							(0, _miscHelpers.closeOldRemindersAndSessions)(user);
							var TaskId = dailyTask.dataValues.Task.id;
							_models2.default.Task.update({
								done: true
							}, {
								where: ['"Tasks"."id" = ?', TaskId]
							}).then(function () {
								controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId }]);
							});
						} else if (addMinutesToDailyTask) {
							// add minutes to current priority and restart `begin_session`

							var _dailyTask$dataValues = dailyTask.dataValues;
							var id = _dailyTask$dataValues.id;
							var minutesSpent = _dailyTask$dataValues.minutesSpent;

							var minutes = minutesSpent + addMinutesToDailyTask;
							_models2.default.DailyTask.update({
								minutes: minutes
							}, {
								where: ['"DailyTasks"."id" = ?', id]
							}).then(function () {
								controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId }]);
							});
						} else if (confirmOverRideSession) {
							// cancel current session and restart `begin_session`
							(0, _miscHelpers.closeOldRemindersAndSessions)(user);
							setTimeout(function () {
								controller.trigger('begin_session', [bot, { SlackUserId: SlackUserId, dailyTaskToWorkOn: dailyTask }]);
							}, 700);
						} else if (sessionStart.endDay) {
							// this should rarely ever, ever happen. (i.e. NEVER)
							(0, _miscHelpers.closeOldRemindersAndSessions)(user);
							setTimeout(function () {
								controller.trigger('end_plan_flow', [bot, { SlackUserId: SlackUserId }]);
							}, 700);
						} else if (confirmStart) {
							// start the session!
							(0, _miscHelpers.closeOldRemindersAndSessions)(user);
							setTimeout(function () {
								(0, _startWorkSessionFunctions.startSessionWithConvoObject)(convo.sessionStart);
							}, 500);
						} else {
							setTimeout(function () {
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
							}, 750);
						}
					});
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