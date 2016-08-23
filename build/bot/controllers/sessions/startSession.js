'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *
  * 		User directly asks to start a session
  * 							~* via Wit *~
  */
	controller.hears(['start_session'], 'direct_message', _index.wit.hears, function (bot, message) {
		var _message$intentObject = message.intentObject.entities;
		var intent = _message$intentObject.intent;
		var reminder = _message$intentObject.reminder;
		var duration = _message$intentObject.duration;
		var datetime = _message$intentObject.datetime;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		var config = {
			SlackUserId: SlackUserId,
			message: message
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			_models2.default.User.find({
				where: { SlackUserId: SlackUserId }
			}).then(function (user) {
				var tz = user.tz;


				if (!tz) {
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
					});
					return;
				} else {
					var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(message, tz);
					if (customTimeObject) {
						var now = (0, _momentTimezone2.default)().tz(tz);
						var minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
						config.minutes = minutes;
					}
					controller.trigger('begin_session', [bot, config]);
				}
			});
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
		var content = config.content;
		var minutes = config.minutes;


		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.tz;

			var UserId = user.id;

			if (!tz) {
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
				});
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				// have 5-minute exit time limit
				convo.task.timeLimit = 1000 * 60 * 5;

				convo.sessionStart = {
					SlackUserId: SlackUserId,
					UserId: UserId,
					tz: tz,
					bot: bot,
					content: content,
					minutes: minutes
				};

				// check for an open session before starting flow
				user.getSessions({
					where: ['"open" = ?', true]
				}).then(function (workSessions) {

					var currentSession = false;

					if (workSessions.length > 0) {
						currentSession = workSessions[0];
					}
					convo.sessionStart.currentSession = currentSession;

					(0, _startSessionFunctions.finalizeSessionTimeAndContent)(convo);
					convo.next();
				});

				convo.on('end', function (convo) {
					var _convo$sessionStart = convo.sessionStart;
					var content = _convo$sessionStart.content;
					var minutes = _convo$sessionStart.minutes;


					console.log("\n\n\n end of start session ");
					console.log(sessionStart);
					console.log("\n\n\n");

					_models2.default.Session.create({
						UserId: UserId,
						startTime: startTime,
						endTime: endTime,
						content: content
					}).then(function (workSession) {

						var dailyTaskIds = [dailyTask.dataValues.id];
						workSession.setDailyTasks(dailyTaskIds);

						var taskString = dailyTask.dataValues.Task.text;
						var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
						var timeString = endTime.format("h:mma");

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							convo.say("Let's do it :boom:!");
							convo.say('Good luck with `' + taskString + '`! See you in ' + minutesString + ' at *' + timeString + '*');
							convo.say({
								text: ':weight_lifter: Your focused work session starts now :weight_lifter:',
								attachments: startSessionOptionsAttachments
							});
						});

						// let's also reprioritize that dailyTask we're currently working on to the top
						if (dailyTasks) {
							(function () {
								var indexOfDailyTask = 0;
								dailyTasks.some(function (currentDailyTask, index) {
									if (currentDailyTask.dataValues.id == dailyTask.dataValues.id) {
										indexOfDailyTask = index;
										return true;
									}
								});
								dailyTasks.move(indexOfDailyTask, 0);
								var priority = 0;
								dailyTasks.forEach(function (dailyTask) {
									priority++;
									_models2.default.DailyTask.update({
										priority: priority
									}, {
										where: ['"DailyTasks"."id" = ?', dailyTask.dataValues.id]
									});
								});
							})();
						}
					});

					// startSessionWithConvoObject(convo.sessionStart);
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

var _constants = require('../../lib/constants');

var _startSessionFunctions = require('./startSessionFunctions');

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=startSession.js.map