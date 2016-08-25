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
			var slackNames = (0, _messageHelpers.getUniqueSlackUsersFromString)(text, { normalSlackNames: true });
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
						(function () {
							// if msg starts with @pinger, remove it from message
							var pingMessage = text[0] == "@" ? text.replace(/@(\S*)/, "").trim() : text;
							// for now this automatically queues to end of focus session
							_models2.default.User.find({
								where: {
									SlackName: toSlackName,
									TeamId: team_id
								}
							}).then(function (toUser) {

								var config = {
									deliveryType: "sessionEnd",
									pingMessages: [pingMessage]
								};
								var fromUserConfig = { UserId: UserId, SlackUserId: SlackUserId };

								if (toUser) {

									// sucess! (this should happen 99% of the time)
									var toUserConfig = { UserId: toUser.dataValues.UserId, SlackUserId: toUser.dataValues.SlackUserId };
									(0, _pingFunctions.sendPing)(bot, fromUserConfig, toUserConfig, config);

									responseObject.text = 'Got it! I\'ll handle that ping :raised_hands:';
									bot.replyPrivate(message, responseObject);
								} else {

									// user might have changed names
									bot.api.users.list({}, function (err, response) {
										console.log('\n\n\n\n FOUND USERS \n\n\n\n');
										if (!err) {
											var members = response.members;

											var foundSlackUserId = false;
											var _toUserConfig = {};
											members.some(function (member) {
												if (toSlackName == member.name) {
													var _SlackUserId = member.id;
													_models2.default.User.update({
														SlackName: name
													}, {
														where: { SlackUserId: _SlackUserId }
													});
													foundSlackUserId = _SlackUserId;
													return true;
												}
											});

											if (foundSlackUserId) {
												_models2.default.User.find({
													where: { SlackUserId: foundSlackUserId }
												}).then(function (toUser) {
													var toUserConfig = { UserId: toUser.dataValues.UserId, SlackUserId: toUser.dataValues.SlackUserId };
													(0, _pingFunctions.sendPing)(bot, fromUserConfig, toUserConfig, config);
													responseObject.text = 'Got it! I\'ll handle that ping :raised_hands:';
													bot.replyPrivate(message, responseObject);
												});
											}
										}
									});
								}
							});
						})();
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