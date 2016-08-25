'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *      SLASH COMMAND FLOW
  */
	controller.on('slash_command', function (bot, message) {

		console.log(message);

		var team_id = message.team_id;
		var user_id = message.user_id;

		var text = message.text.trim();

		var SlackUserId = message.user;
		var env = process.env.NODE_ENV || 'development';

		if (env == "development") {
			message.command = message.command.replace("_dev", "");
		}

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var SlackName = user.SlackName;
			var tz = user.tz;

			var UserId = user.id;

			// make sure verification token matches!
			if (message.token !== process.env.VERIFICATION_TOKEN) {
				console.log('\n ~~ verification token could not be verified ~~ \n');
				return;
			}

			var _message$intentObject = message.intentObject.entities;
			var reminder = _message$intentObject.reminder;
			var duration = _message$intentObject.duration;
			var datetime = _message$intentObject.datetime;


			var now = (0, _momentTimezone2.default)().tz(tz);
			var responseObject = {
				response_type: "ephemeral"
			};
			var slackNames = (0, _messageHelpers.getUniqueSlackUsersFromString)(text, { normalSlackNames: normalSlackNames });
			var customTimeObject = void 0;

			var toSlackName = slackNames.length > 0 ? slackNames[0] : false;

			switch (message.command) {
				case "/focus":

					customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(message, tz);

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
						var _responseText = '';
						if (customNote) {
							_responseText = 'Hey, I need to know what time you want me to remind you about `' + text + '` (please say `' + text + ' in 30 min` or `' + text + ' at 7pm`)!';
						} else {
							_responseText = 'Hey, I need to know when you want me to remind you `i.e. pick up clothes at 7pm`!';
						}
						responseObject.text = _responseText;
						bot.replyPublic(message, responseObject);
					}

					var responseText = 'HELLO WORLD';
					responseObject.text = responseText;
					bot.replyPrivate(message, responseObject);

					break;

				case "/ping":

					// ping requires a receiving end
					if (toSlackName) {
						// if msg starts with @pinger, remove it from message
						var pingMessage = text[0] == "@" ? text.replace(/@(\S*)/, "").trim() : text;
						// for now this automatically queues to end of focus session
						_models2.default.User.find({
							where: {
								SlackName: toSlackName
							}
						});

						var _config = config;
						var deliveryType = _config.deliveryType;
						var pingTimeObject = _config.pingTimeObject;
						var pingMessages = _config.pingMessages;

						(0, _pingFunctions.sendPing)(bot, fromUser, toUser, config);
					} else {
						responseObject.text = 'Let me know who you want to send this ping to! (i.e. `@emily`)';
						bot.replyPrivate(message, responseObject);
					}

					break;

				case "/explain":
					responseObject.text = 'Okay I just explained how this works!';
					bot.replyPrivate(message, responseObject);
					break;
				default:
					responseObject.text = 'I\'m sorry, still learning how to `' + message.command + '`! :dog:';
					bot.replyPrivate(message, responseObject);
					break;
			}
		});
	});
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _pingFunctions = require('../pings/pingFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map