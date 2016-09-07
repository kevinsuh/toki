'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *      SLASH COMMAND FLOW
  */
	controller.on('slash_command', function (bot, message) {
		var team_id = message.team_id;
		var user_id = message.user_id;
		var _message$intentObject = message.intentObject.entities;
		var reminder = _message$intentObject.reminder;
		var duration = _message$intentObject.duration;
		var datetime = _message$intentObject.datetime;


		var text = message.text.trim();
		var SlackUserId = message.user;
		var env = process.env.NODE_ENV || 'development';

		if (env == "development") {
			message.command = message.command.replace("_dev", "");
		}

		// make sure verification token matches!
		if (message.token !== process.env.VERIFICATION_TOKEN) {
			console.log('\n ~~ verification token could not be verified ~~ \n');
			return;
		}

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var SlackName = user.SlackName;
			var tz = user.tz;

			var UserId = user.id;

			var now = (0, _momentTimezone2.default)().tz(tz);
			var responseObject = { response_type: "ephemeral" };
			var slackNames = (0, _messageHelpers.getUniqueSlackUsersFromString)(text, { normalSlackNames: true });

			var customTimeObject = void 0;
			var toSlackName = slackNames.length > 0 ? slackNames[0] : false;

			switch (message.command) {
				case "/priority":

					controller.trigger('begin_session_flow', [bot, message]);
					responseObject.text = 'Woo! Let\'s set your current priority';
					bot.replyPrivate(message, responseObject);
					break;

				case "/ping":

					// ping requires a receiving end
					if (toSlackName) {
						(function () {
							// if msg starts with @pinger, remove it from message
							var pingMessage = text[0] == "@" ? text.replace(/@(\S*)/, "").trim() : text;
							var pingMessages = [];
							if (pingMessage) pingMessages.push(pingMessage);

							// for now this automatically queues to end of session
							_models2.default.User.find({
								where: {
									SlackName: toSlackName,
									TeamId: team_id
								}
							}).then(function (toUser) {

								if (toUser) {

									// check if user is in session... if so, then do not DM receipt
									toUser.getSessions({
										where: ['"open" = ?', true],
										order: '"Session"."createdAt" DESC'
									}).then(function (sessions) {

										var session = sessions[0];

										if (session) {

											var pingFlowConfig = {
												SlackUserId: SlackUserId,
												pingSlackUserIds: [toUser.dataValues.SlackUserId],
												pingMessages: pingMessages
											};

											controller.trigger('ping_flow', [bot, message, pingFlowConfig]);
											responseObject.text = 'Got it! Let\'s deliver that ping :mailbox_with_mail:';
											bot.replyPrivate(message, responseObject);
										} else {

											// user is not in session, no need for DM receipt!
											var fromUserConfig = { UserId: UserId, SlackUserId: SlackUserId };
											var toUserConfig = { UserId: toUser.dataValues.id, SlackUserId: toUser.dataValues.SlackUserId };
											var config = {
												deliveryType: _constants.constants.pingDeliveryTypes.sessionNotIn,
												pingMessages: pingMessages
											};

											(0, _pingFunctions.queuePing)(bot, fromUserConfig, toUserConfig, config);
											responseObject.text = '<@' + toUser.dataValues.SlackUserId + '> is not in a session so I started a conversation for you. Thank you for being mindful of their attention :raised_hands:';
											bot.replyPrivate(message, responseObject);
										}
									});
								} else {

									// user might have changed names ... this is very rare!
									bot.api.users.list({}, function (err, response) {
										if (!err) {
											var members = response.members;

											var foundSlackUserId = false;
											var toUserConfig = {};
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

													var pingFlowConfig = {
														SlackUserId: SlackUserId, // fromUser SlackUserId
														message: message,
														pingSlackUserIds: [toUser.dataValues.SlackUserId],
														pingMessages: pingMessages
													};

													controller.trigger('ping_flow', [bot, pingFlowConfig]);
													responseObject.text = 'Got it! Let\'s deliver that ping :mailbox_with_mail:';
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
					if (toSlackName) {

						// if msg starts with @pinger, remove it from message
						var _pingMessage = text[0] == "@" ? text.replace(/@(\S*)/, "").trim() : text;
						// for now this automatically queues to end of session
						_models2.default.User.find({
							where: {
								SlackName: toSlackName,
								TeamId: team_id
							}
						}).then(function (toUser) {

							if (toUser) {

								var config = {
									fromUserConfig: {
										UserId: user.dataValues.id,
										SlackUserId: user.dataValues.SlackUserId
									},
									toUserConfig: {
										UserId: toUser.dataValues.id,
										SlackUserId: toUser.dataValues.SlackUserId
									}
								};

								controller.trigger('explain_toki_flow', [bot, config]);

								responseObject.text = 'Okay I just explained how I work to <@' + toUser.dataValues.SlackUserId + '>!';
								bot.replyPrivate(message, responseObject);
							}
						});
					} else {
						// assume to self

						var explainConfig = {
							explainToSelf: true,
							UserConfig: {
								UserId: user.dataValues.id,
								SlackUserId: user.dataValues.SlackUserId
							}
						};

						controller.trigger('explain_toki_flow', [bot, explainConfig]);

						responseObject.text = 'Thanks for asking me how I work! If you ever want to explain me to someone else, just include their username (i.e. `@emily`)';
						bot.replyPrivate(message, responseObject);
					}
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