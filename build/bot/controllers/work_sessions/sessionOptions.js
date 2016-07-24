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
						var workSessionId = workSession.id;
						var endTime = (0, _momentTimezone2.default)(workSession.endTime);
						var now = (0, _momentTimezone2.default)();
						var minutesRemaining = Math.round(_momentTimezone2.default.duration(endTime.diff(now)).asMinutes() * 100) / 100; // 2 decimal places

						workSession.update({
							endTime: now,
							live: false
						});

						_models2.default.StoredWorkSession.create({
							WorkSessionId: workSessionId,
							minutes: minutesRemaining
						});

						workSession.getDailyTasks({
							include: [_models2.default.Task]
						}).then(function (dailyTasks) {

							workSession.DailyTasks = dailyTasks;

							var taskTextsToWorkOnArray = dailyTasks.map(function (dailyTask) {
								var text = dailyTask.Task.dataValues.text;
								return text;
							});
							var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

							// making this just a reminder now so that user can end his own session as he pleases
							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

								var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutesRemaining);

								convo.say({
									text: 'I\'ve paused your session. You have *' + timeString + '* remaining for ' + tasksToWorkOnString,
									attachments: [{
										attachment_type: 'default',
										callback_id: "PAUSED_SESSION_OPTIONS",
										fallback: "Your session is paused!",
										actions: [{
											name: _constants.buttonValues.startSession.resume.name,
											text: "Resume",
											value: _constants.buttonValues.startSession.resume.value,
											type: "button",
											style: "primary"
										}, {
											name: _constants.buttonValues.startSession.pause.endEarly.name,
											text: "End Session",
											value: _constants.buttonValues.startSession.pause.endEarly.value,
											type: "button"
										}]
									}]
								});

								convo.next();

								convo.on('end', function (convo) {
									(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
								});
							});
						});
					})();
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

			user.getWorkSessions({
				order: '"WorkSession"."createdAt" DESC',
				limit: 1
			}).then(function (workSessions) {

				if (workSessions.length > 0) {
					(function () {

						var workSession = workSessions[0];
						workSession.getDailyTasks({
							include: [_models2.default.Task],
							where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"]
						}).then(function (dailyTasks) {

							// check if there are live and open tasks still to this work session
							if (dailyTasks.length > 0) {
								(function () {

									var dailyTaskIds = [];
									dailyTasks.forEach(function (dailyTask) {
										dailyTaskIds.push(dailyTask.dataValues.id);
									});

									// only get STILL PAUSED work sessions
									workSession.getStoredWorkSessions({
										order: '"StoredWorkSession"."createdAt" DESC',
										where: ['"StoredWorkSession"."resumed" = ?', "false"],
										limit: 1
									}).then(function (storedWorkSessions) {
										if (storedWorkSessions.length > 0) {
											(function () {
												var storedWorkSession = storedWorkSessions[0];

												var minutes = storedWorkSession.minutes;


												var now = (0, _momentTimezone2.default)();
												var endTime = now.add(minutes, 'minutes');

												// end prev work session
												workSession.update({
													open: false
												});

												// create new work session with those daily tasks
												_models2.default.WorkSession.create({
													startTime: now,
													endTime: endTime,
													UserId: UserId,
													live: true
												}).then(function (workSession) {

													workSession.setDailyTasks(dailyTaskIds);
													// the workSession has been resumed
													storedWorkSession.update({
														resumed: true
													});

													/**
              * 		~~ RESUME WORK SESSION MESSAGE ~~
              */

													var tasksToWorkOnTexts = dailyTasks.map(function (dailyTask) {
														if (dailyTask.dataValues) {
															return dailyTask.dataValues.Task.text;
														} else {
															return dailyTask.text;
														}
													});

													var tasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(tasksToWorkOnTexts);
													var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
													var endTimeString = endTime.format("h:mm a");

													bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
														convo.say({
															text: 'Good luck with ' + tasksString + '!\nSee you in ' + timeString + ' at *' + endTimeString + '* :timer_clock:',
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
											})();
										} else {
											// FAILURE to find storedWorkSession for pausedSession
											bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
												convo.say('Doesn\'t seem like you paused this session :thinking_face:. Let me know if you want to `start a session`');
												convo.next();
												convo.on('end', function (convo) {
													console.log('\n\n\n ~~ should resume aslfkamsflmk ~~ \n\n');
													setTimeout(function () {
														(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
													}, 500);
												});
											});
										}
									});
								})();
							} else {
								// no 
								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
									convo.say('You don\'t have any tasks left for this session! Let me know when you want to `start a session`');
									convo.next();
									convo.on('end', function (convo) {
										(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
									});
								});
							}
						});
					})();
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
			var defaultBreakTime = user.defaultBreakTime;


			user.getWorkSessions({
				where: ['"WorkSession"."open" = ?', true],
				order: '"WorkSession"."createdAt" DESC',
				limit: 1
			}).then(function (workSessions) {

				if (workSessions.length > 0) {

					var workSession = workSessions[0];
					workSession.getDailyTasks({
						include: [_models2.default.Task]
					}).then(function (dailyTasks) {

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							convo.say('~~Let\'s add a CHECKIN!!~~');
							convo.next();

							convo.on('end', function (convo) {
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
							});
						});
					});
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

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// ALL OF THE TIMEOUT FUNCTIONALITIES
//# sourceMappingURL=sessionOptions.js.map