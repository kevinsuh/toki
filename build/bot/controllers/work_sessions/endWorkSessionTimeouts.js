'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * 			~~ START OF SESSION_TIMER FUNCTIONALITIES ~~
  */

	// we put users in this ether when it has been a 30 mintime out!
	controller.on('done_session_timeout_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var workSession = config.workSession;

		var dailyTaskIds = workSession.DailyTasks.map(function (dailyTask) {
			return dailyTask.id;
		});

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			user.getWorkSessions({
				where: ['"WorkSession"."open" = ?', true],
				order: '"WorkSession"."createdAt" DESC',
				limit: 1
			}).then(function (workSessions) {
				// get most recent work session for snooze option
				if (workSessions.length > 0) {
					var workSession = workSessions[0];
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

							convo.say({
								text: 'Hey! It\'s been 30 minutes since you wanted to finish ' + tasksToWorkOnString + '. Did you finish the task?',
								attachments: [{
									attachment_type: 'default',
									callback_id: "DONE_SESSION",
									fallback: "I was unable to process your decision",
									actions: [{
										name: _constants.buttonValues.doneSessionTimeoutYes.name,
										text: "Yes! :punch:",
										value: _constants.buttonValues.doneSessionTimeoutYes.value,
										type: "button",
										style: "primary"
									}, {
										name: _constants.buttonValues.doneSessionTimeoutSnooze.name,
										text: "Snooze :timer_clock:",
										value: _constants.buttonValues.doneSessionTimeoutSnooze.value,
										type: "button"
									}, {
										name: _constants.buttonValues.doneSessionTimeoutDidSomethingElse.name,
										text: "Did something else",
										value: _constants.buttonValues.doneSessionTimeoutDidSomethingElse.value,
										type: "button"
									}, {
										name: _constants.buttonValues.doneSessionTimeoutNo.name,
										text: "Nope",
										value: _constants.buttonValues.doneSessionTimeoutNo.value,
										type: "button"
									}]
								}]
							});
							convo.say("Please click one of the items above if applicable!");
							convo.next();
						});
					});
				}
			});
		});
	});

	// `yes` button flow
	controller.on('done_session_yes_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			if (botCallback) {
				// if botCallback, need to get the correct bot
				var botToken = bot.config.token;
				bot = _index.bots[botToken];
			}

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

						workSession.DailyTasks = dailyTasks;
						var completedTaskIds = workSession.DailyTasks.map(function (dailyTask) {
							return dailyTask.TaskId;
						});

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							convo.sessionEnd = {
								SlackUserId: SlackUserId,
								postSessionDecision: false,
								reminders: [],
								completedTaskIds: completedTaskIds
							};

							(0, _endWorkSession.askUserPostSessionOptions)(err, convo);
							convo.next();

							convo.on('end', function (convo) {
								var _convo$sessionEnd = convo.sessionEnd;
								var postSessionDecision = _convo$sessionEnd.postSessionDecision;
								var reminders = _convo$sessionEnd.reminders;
								var completedTaskIds = _convo$sessionEnd.completedTaskIds;


								_models2.default.Task.update({
									done: true
								}, {
									where: ['"Tasks"."id" in (?)', completedTaskIds]
								});

								user.getWorkSessions({
									where: ['"WorkSession"."open" = ?', true],
									order: '"createdAt" DESC'
								}).then(function (workSessions) {
									workSessions.forEach(function (workSession) {
										workSession.update({
											open: false
										});
									});
								});

								(0, _endWorkSession.handlePostSessionDecision)(controller, postSessionDecision);
							});
						});
					});
				}
			});
		});
	});

	// `snooze` button flow
	controller.on('done_session_snooze_button_flow', function (bot, config) {

		// optionally can get duration if passed in via NL
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;
		var snoozeTimeObject = config.snoozeTimeObject;
		var remindTimeStampObject = config.remindTimeStampObject;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			var defaultSnoozeTime = user.defaultSnoozeTime;


			var snoozeTime = defaultSnoozeTime ? defaultSnoozeTime : _constants.TOKI_DEFAULT_SNOOZE_TIME;

			if (botCallback) {
				// if botCallback, need to get the correct bot
				var botToken = bot.config.token;
				bot = _index.bots[botToken];
			}

			var tz = user.SlackUser.tz;

			var UserId = user.id;

			var now = (0, _momentTimezone2.default)().tz(tz);
			var snoozeTimeObject = now.add(snoozeTime, 'minutes');

			// CUSTOM NL SNOOZE FROM USER
			if (remindTimeStampObject) {
				snoozeTimeObject = remindTimeStampObject;
			}

			var snoozeTimeString = snoozeTimeObject.format("h:mm a");

			_models2.default.Reminder.create({
				remindTime: snoozeTimeObject,
				UserId: UserId,
				type: "done_session_snooze"
			}).then(function (reminder) {
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					convo.snoozeObject = {
						defaultSnoozeTime: defaultSnoozeTime
					};

					if (!defaultSnoozeTime && !remindTimeStampObject) {
						convo.say('Wait, this is your first time hitting snooze! The default snooze is *' + _constants.TOKI_DEFAULT_SNOOZE_TIME + ' minutes*, but you can change it in your settings by telling me to `show settings`');
						convo.say("You can also specify a custom snooze by saying `snooze for 20 minutes` or something like that :grinning:");
					}

					convo.say('I\'ll check in with you at ' + snoozeTimeString + ' :fist:');
					convo.next();

					convo.on('end', function (convo) {
						var defaultSnoozeTime = convo.snoozeObject.defaultSnoozeTime;

						// set snooze to default snooze if null

						if (!defaultSnoozeTime) {
							user.update({
								defaultSnoozeTime: _constants.TOKI_DEFAULT_SNOOZE_TIME
							});
						}
					});
				});
			});
		});
	});

	// `no` button flow
	controller.on('done_session_no_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var botCallback = config.botCallback;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			if (botCallback) {
				// if botCallback, need to get the correct bot
				var botToken = bot.config.token;
				bot = _index.bots[botToken];
			}

			// making this just a reminder now so that user can end his own session as he pleases
			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				convo.sessionEnd = {
					SlackUserId: SlackUserId,
					postSessionDecision: false,
					reminders: []
				};

				(0, _endWorkSession.askUserPostSessionOptions)(err, convo);
				convo.next();

				convo.on('end', function (convo) {
					var _convo$sessionEnd2 = convo.sessionEnd;
					var postSessionDecision = _convo$sessionEnd2.postSessionDecision;
					var reminders = _convo$sessionEnd2.reminders;


					user.getWorkSessions({
						where: ['"WorkSession"."open" = ?', true],
						order: '"createdAt" DESC'
					}).then(function (workSessions) {
						workSessions.forEach(function (workSession) {
							workSession.update({
								open: false
							});
						});
					});

					(0, _endWorkSession.handlePostSessionDecision)(controller, postSessionDecision);
				});
			});
		});
	});

	/**
  * 			~~ END OF DONE_SESSION TIMER FUNCTIONALITIES ~~
  */
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

var _endWorkSession = require('./endWorkSession');

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// ALL OF THE TIMEOUT FUNCTIONALITIES
//# sourceMappingURL=endWorkSessionTimeouts.js.map