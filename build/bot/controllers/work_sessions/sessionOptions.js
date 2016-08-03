'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * 			~~ START OF SESSION_OPTIONS FUNCTIONALITIES ~~
  */

	controller.on('session_pause_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;


		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			user.getWorkSessions({
				where: ['"WorkSession"."open" = ?', true],
				order: '"WorkSession"."createdAt" DESC',
				limit: 1
			}).then(function (workSessions) {

				// end most recent work session, and create new storedWorkSession
				// with the remaining minutes
				if (workSessions.length > 0) {
					(function () {

						var workSession = workSessions[0];

						workSession.getStoredWorkSession({
							where: ['"StoredWorkSession"."live" = ?', true]
						}).then(function (storedWorkSession) {

							// GOOD TO PAUSE NOW
							var workSessionId = workSession.id;
							var endTime = (0, _momentTimezone2.default)(workSession.endTime);
							var now = (0, _momentTimezone2.default)();
							var minutesRemaining = Math.round(_momentTimezone2.default.duration(endTime.diff(now)).asMinutes() * 100) / 100; // 2 decimal places

							workSession.getDailyTasks({
								include: [_models2.default.Task]
							}).then(function (dailyTasks) {

								workSession.DailyTasks = dailyTasks;

								var taskTextsToWorkOnArray = dailyTasks.map(function (dailyTask) {
									var text = dailyTask.Task.dataValues.text;
									return text;
								});
								var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);
								var timeString = void 0;
								var message = void 0;

								if (storedWorkSession) {

									// already in pause!
									var minutes = storedWorkSession.dataValues.minutes;


									timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
									message = 'Wait, your session is already on pause! You have *' + timeString + '* remaining for ' + tasksToWorkOnString;
								} else {

									/**
          * 		~~ GOOD TO GO TO PAUSE SESSION! ~~
          */

									workSession.update({
										endTime: (0, _momentTimezone2.default)(),
										live: false
									});

									_models2.default.StoredWorkSession.create({
										WorkSessionId: workSessionId,
										minutes: minutesRemaining
									});

									timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutesRemaining);
									message = 'Your session is paused :double_vertical_bar:. You have *' + timeString + '* remaining for `' + tasksToWorkOnString + '`';
								}
								// making this just a reminder now so that user can end his own session as he pleases
								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

									convo.say({
										text: message,
										attachments: _constants.pausedSessionOptionsAttachments
									});

									convo.next();

									convo.on('end', function (convo) {
										(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
									});
								});
							});
						});
					})();
				} else {
					notInSessionWouldYouLikeToStartOne({ bot: bot, controller: controller, SlackUserId: SlackUserId });
				}
			});
		});
	});

	controller.on('session_resume_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;


		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var tz = user.SlackUser.tz;

			// get THE most recently created workSession for that user

			user.getWorkSessions({
				order: '"WorkSession"."createdAt" DESC',
				limit: 1
			}).then(function (workSessions) {

				if (workSessions.length > 0) {
					(function () {

						var workSession = workSessions[0];

						workSession.getStoredWorkSession({
							where: ['"StoredWorkSession"."live" = ?', true]
						}).then(function (storedWorkSession) {

							workSession.getDailyTasks({
								include: [_models2.default.Task],
								where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"]
							}).then(function (dailyTasks) {

								if (dailyTasks.length > 0) {
									(function () {

										// we are in the clear to resume the session!
										var dailyTaskIds = [];
										dailyTasks.forEach(function (dailyTask) {
											dailyTaskIds.push(dailyTask.dataValues.id);
										});

										var now = (0, _momentTimezone2.default)();

										var tasksToWorkOnTexts = dailyTasks.map(function (dailyTask) {
											if (dailyTask.dataValues) {
												return dailyTask.dataValues.Task.text;
											} else {
												return dailyTask.text;
											}
										});

										var tasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(tasksToWorkOnTexts);
										var timeString = void 0;
										var endTime = void 0;
										var endTimeString = void 0;

										if (storedWorkSession) {
											// existing paused session to resume

											var minutes = storedWorkSession.minutes;

											endTime = now.add(minutes, 'minutes').tz(tz);
											endTimeString = endTime.format("h:mm a");
											timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

											workSession.update({
												open: false
											});

											// create new work session with those daily tasks
											_models2.default.WorkSession.create({
												startTime: (0, _momentTimezone2.default)(),
												endTime: endTime,
												UserId: UserId,
												live: true
											}).then(function (workSession) {

												// add new daily tasks to the workSession
												workSession.setDailyTasks(dailyTaskIds);

												/**
             * 		~~ RESUME WORK SESSION MESSAGE ~~
             */

												bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
													convo.say({
														text: 'Resumed :arrow_forward:! Good luck with `' + tasksString + '`!\n\nSee you in ' + timeString + ' at *' + endTimeString + '* :timer_clock:',
														attachments: _constants.startSessionOptionsAttachments
													});
													convo.next();
													convo.on('end', function (convo) {
														setTimeout(function () {
															(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
														}, 500);
													});
												});
											});
										} else {

											// no paused sessions: either in live one or not in one!
											if (workSession.dataValues.open) {

												endTime = (0, _momentTimezone2.default)(workSession.dataValues.endTime).tz(tz);
												endTimeString = endTime.format("h:mm a");
												var minutesRemaining = _momentTimezone2.default.duration(endTime.diff(now)).asMinutes();
												timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutesRemaining);

												bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
													convo.say('Wait, your session has already been resumed! You have ' + timeString + ' remaining for ' + tasksString);
													convo.say({
														text: 'See you at *' + endTimeString + '*  :timer_clock:',
														attachments: _constants.startSessionOptionsAttachments
													});
													convo.next();
													convo.on('end', function (convo) {
														setTimeout(function () {
															(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
														}, 500);
													});
												});
											} else {
												notInSessionWouldYouLikeToStartOne({ bot: bot, controller: controller, SlackUserId: SlackUserId });
											}
										}
									})();
								} else {
									notInSessionWouldYouLikeToStartOne({ bot: bot, controller: controller, SlackUserId: SlackUserId });
								}
							});
						});
					})();
				} else {
					notInSessionWouldYouLikeToStartOne({ bot: bot, controller: controller, SlackUserId: SlackUserId });
				}
			});
		});
	});

	controller.on('session_add_checkin_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;


		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			var tz = user.SlackUser.tz;

			var UserId = user.id;

			user.getWorkSessions({
				where: ['"WorkSession"."open" = ?', true],
				order: '"WorkSession"."createdAt" DESC',
				limit: 1
			}).then(function (workSessions) {

				if (workSessions.length > 0) {

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						convo.say('Let\'s add a checkin!');
						convo.next();

						convo.on('end', function (convo) {

							var config = { SlackUserId: SlackUserId };
							config.reminder_type = "work_session";
							controller.trigger('ask_for_reminder', [bot, config]);

							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						});
					});
				} else {
					notInSessionWouldYouLikeToStartOne({ bot: bot, controller: controller, SlackUserId: SlackUserId });
				}
			});
		});
	});

	controller.on('session_end_early_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;
		var storedWorkSession = config.storedWorkSession;


		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		controller.trigger('done_session_flow', [bot, config]);
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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// ALL OF THE TIMEOUT FUNCTIONALITIES


function notInSessionWouldYouLikeToStartOne(config) {
	var bot = config.bot;
	var SlackUserId = config.SlackUserId;
	var controller = config.controller;

	if (bot && SlackUserId && controller) {
		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
			convo.ask('You\'re not in a session right now! Would you like to start one :muscle:?', [{
				pattern: _botResponses.utterances.yes,
				callback: function callback(response, convo) {
					convo.startSession = true;
					convo.next();
				}
			}, {
				pattern: _botResponses.utterances.no,
				callback: function callback(response, convo) {
					convo.say("Okay! I'll be here when you want to `start a session` :smile_cat:");
					convo.next();
				}
			}, {
				default: true,
				callback: function callback(response, convo) {
					convo.say("Sorry, I didn't catch that");
					convo.repeat();
					convo.next();
				}
			}]);
			convo.next();
			convo.on('end', function (convo) {
				if (convo.startSession) {
					controller.trigger('confirm_new_session', [bot, { SlackUserId: SlackUserId }]);
				}
				setTimeout(function () {
					(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
				}, 500);
			});
		});
	}
}
//# sourceMappingURL=sessionOptions.js.map