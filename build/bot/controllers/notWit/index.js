'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.hears(['^pin[ng]{1,4}'], 'direct_message', function (bot, message) {
		var _message$intentObject = message.intentObject.entities;
		var intent = _message$intentObject.intent;
		var reminder = _message$intentObject.reminder;
		var duration = _message$intentObject.duration;
		var datetime = _message$intentObject.datetime;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;

		var pingSlackUserIds = (0, _messageHelpers.getUniqueSlackUsersFromString)(text);

		var pingMessages = [];
		if (pingSlackUserIds) {
			// this replaces up to "ping <@UIFSMIOM>"
			var pingMessage = text.replace(/^pi[ng]{1,4}([^>]*>)?/, "").trim();
			if (pingMessage) {
				pingMessages.push(pingMessage);
			}
		}

		var config = {
			SlackUserId: SlackUserId,
			message: message,
			pingSlackUserIds: pingSlackUserIds,
			pingMessages: pingMessages
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('ping_flow', [bot, config]);
		}, 650);
	});

	controller.hears(['^{'], 'direct_message', _hearsMiddleware.isJsonObject, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			try {
				var jsonObject = JSON.parse(text);
				var updatePing = jsonObject.updatePing;
				var cancelPing = jsonObject.cancelPing;
				var sendBomb = jsonObject.sendBomb;
				var PingId = jsonObject.PingId;

				if (updatePing) {
					var config = { PingId: PingId, sendBomb: sendBomb, cancelPing: cancelPing };
					controller.trigger('update_ping_message', [bot, config]);
				}
			} catch (error) {
				// this should never happen!
				bot.reply(message, "Hmm, something went wrong");
				return false;
			}
		}, 500);
	});

	// defer ping!
	controller.hears([_constants.utterances.deferPing], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		bot.send({
			type: "typing",
			channel: message.channel
		});

		// defer all pings from this user
		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.tz;

			var UserId = user.id;

			_models2.default.Session.find({
				where: {
					UserId: UserId,
					live: true,
					open: true
				}
			}).then(function (session) {

				if (session) {
					session.update({
						superFocus: true
					}).then(function (session) {
						var _session$dataValues = session.dataValues;
						var endTime = _session$dataValues.endTime;
						var content = _session$dataValues.content;

						var endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
						var endTimeString = endTimeObject.format("h:mma");

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							var text = ':palm_tree: I’ll follow up with you to send your message after your focused session on `' + content + '` ends at *' + endTimeString + '*. Good luck! :palm_tree:';
							var attachments = [{
								attachment_type: 'default',
								callback_id: "DEFERRED_PING_SESSION_OPTIONS",
								fallback: "Good luck with your focus session!",
								actions: [{
									name: _constants.buttonValues.sendSooner.name,
									text: "Send Sooner",
									value: _constants.buttonValues.sendSooner.value,
									type: "button"
								}, {
									name: _constants.buttonValues.endSession.name,
									text: "End Session",
									value: _constants.buttonValues.endSession.value,
									type: "button"
								}]
							}];

							convo.say({
								text: text,
								attachments: attachments
							});
						});
					});
				} else {
					(0, _sessions.notInSessionWouldYouLikeToStartOne)({ bot: bot, SlackUserId: SlackUserId, controller: controller });
				}
			});
		});
	});

	controller.hears([_constants.utterances.sendSooner], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		bot.send({
			type: "typing",
			channel: message.channel
		});

		// un-defer all pings from this user
		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.tz;

			var UserId = user.id;

			_models2.default.Session.find({
				where: {
					UserId: UserId,
					live: true,
					open: true
				}
			}).then(function (session) {

				if (session) {
					session.update({
						superFocus: false
					}).then(function (session) {
						var _session$dataValues2 = session.dataValues;
						var endTime = _session$dataValues2.endTime;
						var content = _session$dataValues2.content;

						var endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
						var endTimeString = endTimeObject.format("h:mma");

						_models2.default.Ping.findAll({
							where: ['"Ping"."FromUserId" = ? AND "Ping"."live" = ?', UserId, true],
							include: [{ model: _models2.default.User, as: 'FromUser' }, { model: _models2.default.User, as: 'ToUser' }, _models2.default.PingMessage],
							order: '"Ping"."createdAt" ASC'
						}).then(function (pings) {

							// get all the sessions associated with pings that come FromUser
							var pingerSessionPromises = [];

							pings.forEach(function (ping) {
								var ToUserId = ping.dataValues.ToUserId;

								pingerSessionPromises.push(_models2.default.Session.find({
									where: {
										UserId: ToUserId,
										live: true,
										open: true
									},
									include: [_models2.default.User]
								}));
							});

							Promise.all(pingerSessionPromises).then(function (pingerSessions) {

								pings.forEach(function (ping) {

									var pingToUserId = ping.dataValues.ToUserId;
									pingerSessions.forEach(function (pingerSession) {
										if (pingerSession && pingToUserId == pingerSession.dataValues.UserId) {
											// the session for ToUser of this ping
											ping.dataValues.session = pingerSession;
											return;
										}
									});
								});

								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

									var text = ':palm_tree: You\'re in a focused session on `' + content + '` until *' + endTimeString + '* :palm_tree:';
									var attachments = (0, _messageHelpers.getStartSessionOptionsAttachment)(pings);

									if (pings.length > 0) {
										(function () {
											// success in sendSooner!

											var config = { customOrder: true, order: ['deferPing', 'endSession'] };
											attachments = (0, _messageHelpers.getStartSessionOptionsAttachment)(pings, config);

											// get slackNames and earliest endTime for pending fromUser pings
											var slackUserIds = [];
											var pingEndTime = (0, _momentTimezone2.default)().tz(tz);

											pings.forEach(function (ping) {
												var _ping$dataValues = ping.dataValues;
												var deliveryType = _ping$dataValues.deliveryType;
												var ToUser = _ping$dataValues.ToUser;
												var pingTime = _ping$dataValues.pingTime;
												var session = _ping$dataValues.session;

												if (!_lodash2.default.includes(slackUserIds, ToUser.dataValues.SlackUserId)) {

													slackUserIds.push(ToUser.dataValues.SlackUserId);
													var thisPingEndTime = void 0;
													if (pingTime) {
														thisPingEndTime = (0, _momentTimezone2.default)(thisPingEndTime).tz(tz);
													} else if (deliveryType == _constants.constants.pingDeliveryTypes.sessionEnd && session) {
														thisPingEndTime = (0, _momentTimezone2.default)(session.dataValues.endTime).tz(tz);
													}

													if (thisPingEndTime > pingEndTime) {
														pingEndTime = thisPingEndTime;
													}
												}
											});

											// deferred ping cant be past endTime!
											if (endTimeObject < pingEndTime) {
												pingEndTime = endTimeObject;
											}

											var pingEndTimeString = pingEndTime.format("h:mma");
											var slackNamesString = (0, _messageHelpers.commaSeparateOutStringArray)(slackUserIds, { SlackUserIds: true });

											var outstandingPingText = pings.length == 1 ? 'Your ping' : 'Your pings';
											text = outstandingPingText + ' for ' + slackNamesString + '  will be delivered at or before ' + pingEndTimeString + '. Until then, good luck with `' + content + '`! :fist:';

											convo.say({
												text: text,
												attachments: attachments
											});
										})();
									} else {
										// just continue the session
										convo.say({
											text: text,
											attachments: attachments
										});
									}
								});
							});
						});
					});
				} else {
					(0, _sessions.notInSessionWouldYouLikeToStartOne)({ bot: bot, SlackUserId: SlackUserId, controller: controller });
				}
			});
		});
	});

	controller.hears([_constants.constants.THANK_YOU.reg_exp], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			bot.reply(message, "You're welcome!! :smile:");
		}, 500);
	});

	// when user wants to "change time and task" of an existing session,
	// it will basically create new session flow
	controller.hears([_constants.utterances.changeTimeAndTask], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			var config = { SlackUserId: SlackUserId, changeTimeAndTask: true };
			controller.trigger('begin_session_flow', [bot, config]);
		}, 500);
	});

	// TOKI_T1ME TESTER
	controller.hears(['TOKI_T1ME'], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var text = message.text;

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			controller.trigger('TOKI_TIME_flow', [bot, { SlackUserId: SlackUserId }]);
		}, 1000);
	});

	controller.on('TOKI_TIME_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		// IncluderSlackUserId is the one who's actually using Toki

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var email = user.email;
			var SlackName = user.SlackName;
			var tz = user.tz;


			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				convo.say('Hey, @' + SlackName + '!  Nice to meet ya');
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _hearsMiddleware = require('../../middleware/hearsMiddleware');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _sessions = require('../sessions');

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map