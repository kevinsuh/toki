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
							open: false,
							live: false
						});

						_models2.default.StoredWorkSession.create({
							workSessionId: workSessionId,
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
									text: 'You have *' + timeString + '* remaining for ' + tasksToWorkOnString,
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
											name: _constants.buttonValues.startSession.endEarly.name,
											text: "End Session",
											value: _constants.buttonValues.startSession.endEarly.value,
											type: "button"
										}]
									}]
								});

								convo.next();
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

							convo.say('~~Let\'s RESOOOOM!!~~');
							convo.next();

							convo.on('end', function (convo) {});
						});
					});
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

							convo.on('end', function (convo) {});
						});
					});
				}
			});
		});
	});

	controller.on('session_end_early_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;


		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot = _index.bots[botToken];
		}

		controller.trigger('done_session_flow', [bot, { SlackUserId: SlackUserId }]);
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