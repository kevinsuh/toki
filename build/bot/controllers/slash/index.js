'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *      SLASH COMMAND FLOW
  */

	controller.on('slash_command', function (bot, message) {

		var SlackUserId = message.user;
		var env = process.env.NODE_ENV || 'development';

		if (env == "development") {
			message.command = message.command.replace("_dev", "");
		}

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {
			var nickName = user.nickName;
			var tz = user.SlackUser.tz;

			var UserId = user.id;

			// make sure verification token matches!
			if (message.token !== process.env.VERIFICATION_TOKEN) {
				console.log('\n ~~ verification token could not be verified ~~ \n');
				(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
				return;
			}

			user.getDailyTasks({
				where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
				include: [_models2.default.Task],
				order: '"DailyTask"."priority" ASC'
			}).then(function (dailyTasks) {
				var _message$intentObject = message.intentObject.entities;
				var reminder = _message$intentObject.reminder;
				var duration = _message$intentObject.duration;
				var datetime = _message$intentObject.datetime;


				var now = (0, _momentTimezone2.default)();
				var responseObject = {
					response_type: "in_channel"
				};

				switch (message.command) {
					case "/add":
						/*
      {"msg_id":"c02a017f-10d5-4b24-ab74-ee85c8955b42","_text":"clean up room for 30 minutes","entities":{"reminder":[{"confidence":0.9462485198304393,"entities":{},"type":"value","value":"clean up room","suggested":true}],"duration":[{"confidence":0.9997298403843689,"minute":30,"value":30,"unit":"minute","normalized":{"value":1800,"unit":"second"}}]}}
      */

						var totalMinutes = 0;
						dailyTasks.forEach(function (dailyTask) {
							var minutes = dailyTask.dataValues.minutes;

							totalMinutes += minutes;
						});

						var timeString = (0, _messageHelpers.convertMinutesToHoursString)(totalMinutes);
						var text = reminder ? reminder[0].value : message.text;

						if (text == '') text = null; // cant have blank text

						var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(message, tz);

						if (text && customTimeObject) {

							// quick adding a task requires both text + time!

							var minutes;
							if (duration) {
								minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
							} else {
								// datetime
								minutes = parseInt(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
							}

							// we have the task and minutes, create task now
							var newPriority = dailyTasks.length + 1;
							_models2.default.Task.create({
								text: text
							}).then(function (task) {
								_models2.default.DailyTask.create({
									TaskId: task.id,
									priority: newPriority,
									minutes: minutes,
									UserId: UserId
								}).then(function () {

									responseObject.text = 'Nice, I added `' + text + ' (' + minutes + ' min)` to your task list! You have ' + timeString + ' of work remaining over ' + newPriority + ' tasks :muscle:';
									bot.replyPublic(message, responseObject);
								});
							});
						} else {

							var responseText = '';
							if (text) {
								responseText = 'Hey, I need to know how long you want to work on `' + text + '` for! (please say `' + text + ' for 30 min` or ` ' + text + ' until 3pm`)';
							} else {
								responseText = 'Hey, I need to know what task you want to add `i.e. clean market report for 30 minutes`!';
							}
							responseObject.text = responseText;
							bot.replyPublic(message, responseObject);
						}

						break;
					case "/note":

						var customNote = reminder ? reminder[0].value : null;

						var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(message, tz);

						if (customTimeObject) {

							// quick adding a reminder requires both text + time!
							_models2.default.Reminder.create({
								remindTime: customTimeObject,
								UserId: UserId,
								customNote: customNote
							}).then(function (reminder) {
								var customTimeString = customTimeObject.format('h:mm a');
								var responseText = 'Okay, I\'ll remind you at ' + customTimeString;
								if (customNote) {
									responseText = responseText + ' about `' + customNote + '`';
								}
								responseText = responseText + '! :alarm_clock:';
								responseObject.text = responseText;
								bot.replyPublic(message, responseObject);
							});
						} else {
							var responseText = '';
							if (customNote) {
								responseText = 'Hey, I need to know what time you want me to remind you about `' + text + '` (please say `' + text + ' in 30 min` or `' + text + ' at 7pm`)!';
							} else {
								responseText = 'Hey, I need to know you want me to remind you about `i.e. pick up clothes at 7pm`!';
							}
							responseObject.text = responseText;
							bot.replyPublic(message, responseObject);
						}

						break;
					case "/help":
					default:
						responseObject.text = 'I\'m sorry, still learning how to `' + message.command + '`! :dog:';
						bot.replyPublic(message, responseObject);
						break;
				}
				(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _miscHelpers = require('../../lib/miscHelpers');

var _messageHelpers = require('../../lib/messageHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map