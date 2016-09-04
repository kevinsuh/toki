'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * DEFAULT FALLBACK
  */
	controller.hears([_constants.constants.ANY_CHARACTER.reg_exp], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var text = message.text;


		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			var replyMessage = "I'm not sure what you mean by that :thinking_face:";

			var config = { SlackUserId: SlackUserId };

			// some fallbacks for button clicks
			switch (text) {
				case (text.match(_constants.utterances.keepWorking) || {}).input:
					controller.trigger('current_session_status', [bot, config]);
					break;
				default:
					bot.reply(message, replyMessage);
					controller.trigger('current_session_status', [bot, config]);
					break;
			}
		}, 500);
	});

	controller.on('explain_toki_flow', function (bot, config) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var fromUserConfig = config.fromUserConfig;
		var toUserConfig = config.toUserConfig;


		_models2.default.User.find({
			where: { SlackUserId: toUserConfig.SlackUserId }
		}).then(function (toUser) {
			var SlackUserId = toUser.SlackUserId;


			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				// have 5-minute exit time limit
				if (convo) convo.task.timeLimit = 1000 * 60 * 5;

				convo.say('Hey! <@' + fromUserConfig.SlackUserId + '> wanted me to explain how I can also help you get your most meaningful things done each day');
				convo.say('Think of me as an office manager for each of your teammate\'s attention. *I make sure you only get interrupted with messages that are actually urgent*, so that you can maintain focus on your priorities');
				convo.say('On the flip side, *I also make it easy for you to ping teammates when they\'re actually ready to switch contexts.* This lets you get requests out of your head when you think of them, while making sure it doesn\'t unnecessarily interrupt anyone\'s flow');
				convo.say({
					text: 'Here\'s how I do this:',
					attachments: _constants.tokiExplainAttachments
				});
				convo.say('I\'m here whenever you\'re ready to go! Just let me know when you want to `/ping` someone, or enter a `/focus` session yourself :raised_hands:');

				convo.on('end', function (convo) {});
			});
		});
	});

	controller.on('daily_recap_flow', function (bot, config) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var tz = user.tz;
			var dailyRecapTime = user.dailyRecapTime;

			var UserId = user.id;

			var dailyRecapTimeObject = (0, _momentTimezone2.default)(dailyRecapTime).tz(tz);

			var previousDaysTime = dailyRecapTimeObject.subtract(1, 'day').format("YYYY-MM-DD HH:mm:ss Z");
			user.getSessions({
				where: ['"startTime" > ?', previousDaysTime]
			}).then(function (sessions) {

				_models2.default.Ping.findAll({
					where: ['("Ping"."ToUserId" = ? OR "Ping"."FromUserId" = ?) AND "Ping"."createdAt" > ?', UserId, UserId, previousDaysTime],
					include: [{ model: _models2.default.User, as: 'FromUser' }, { model: _models2.default.User, as: 'ToUser' }, _models2.default.PingMessage],
					order: '"Ping"."createdAt" ASC'
				}).then(function (pings) {

					var fromUserPings = [];
					var toUserPings = [];

					pings.forEach(function (ping) {
						if (ping.FromUserId == UserId) {
							fromUserPings.push(ping);
						} else if (ping.ToUserId == UserId) {
							toUserPings.push(ping);
						}
					});

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						// have 5-minute exit time limit
						if (convo) convo.task.timeLimit = 1000 * 60 * 5;

						convo.say('Hey <@' + SlackUserId + '>!');

						// sessions recap
						if (sessions.length > 0) {
							(function () {

								var text = '';
								var attachments = [];
								var totalTimeInSessions = 0;

								sessions.forEach(function (session) {
									var content = session.content;
									var startTime = session.startTime;
									var endTime = session.endTime;


									var startTimeObject = (0, _momentTimezone2.default)(startTime).tz(tz);
									var endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
									var sessionMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(startTimeObject)).asMinutes());
									var sessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(sessionMinutes);

									totalTimeInSessions += sessionMinutes;

									var sessionInfoMessage = '`' + content + '` for *' + sessionTimeString + '*';

									attachments.push({
										attachment_type: 'default',
										mrkdwn_in: ["text", "pretext"],
										callback_id: "SESSION_INFO",
										color: _constants.colorsHash.toki_purple.hex,
										fallback: sessionInfoMessage,
										text: sessionInfoMessage
									});
								});

								var totalTimeInSessionsString = (0, _messageHelpers.convertMinutesToHoursString)(totalTimeInSessions);
								text = 'You spent ' + totalTimeInSessionsString + ' in focused sessions today. Here\'s a quick breakdown of what you spent your time on:';

								convo.say({
									text: text,
									attachments: attachments
								});
							})();
						}

						// pings sent to recap
						if (toUserPings.length > 0) {
							(function () {

								var text = '';
								var attachments = [];
								var totalPingsToCount = toUserPings.length;
								var totalBombsToCount = 0;

								var toUserPingsContainer = { fromUser: {} };

								toUserPings.forEach(function (ping) {
									var _ping$dataValues = ping.dataValues;
									var FromUser = _ping$dataValues.FromUser;
									var deliveryType = _ping$dataValues.deliveryType;

									var FromUserSlackUserId = FromUser.dataValues.SlackUserId;

									var pingContainer = toUserPingsContainer.fromUser[FromUserSlackUserId] || { bombCount: 0, pingCount: 0 };
									pingContainer.pingCount++;
									if (deliveryType == _constants.constants.pingDeliveryTypes.bomb) {
										pingContainer.bombCount++;
										totalBombsToCount++;
									}
									toUserPingsContainer.fromUser[FromUserSlackUserId] = pingContainer;
								});

								var SlackUserIdForMostBombs = void 0;
								var mostBombs = 0;
								var SlackUserIdForMostPings = void 0;
								var mostPings = 0;

								for (var FromUserSlackUserId in toUserPingsContainer.fromUser) {

									if (!toUserPingsContainer.fromUser.hasOwnProperty(FromUserSlackUserId)) {
										continue;
									}

									var pingContainer = toUserPingsContainer.fromUser[FromUserSlackUserId];
									var bombCount = pingContainer.bombCount;
									var pingCount = pingContainer.pingCount;


									if (bombCount > mostBombs) {
										mostBombs = bombCount;
										SlackUserIdForMostBombs = FromUserSlackUserId;
									}
									if (pingCount > mostPings) {
										mostPings = pingCount;
										SlackUserIdForMostPings = FromUserSlackUserId;
									}
								}

								var pingCountString = totalPingsToCount == 1 ? '*' + totalPingsToCount + '* ping' : '*' + totalPingsToCount + '* pings';
								var bombCountString = totalBombsToCount == 1 ? totalBombsToCount + ' bomb' : totalBombsToCount + ' bombs';
								text = 'You received ' + pingCountString + ' today, including ' + bombCountString + ' that interrupted your workflow:';

								if (mostPings > 0) {
									var mostPingsString = 'Most pings received from: <@' + SlackUserIdForMostPings + '> :mailbox_closed:';
									attachments.push({
										attachment_type: 'default',
										mrkdwn_in: ["text", "pretext"],
										callback_id: "PINGS_RECEIVED_FROM",
										fallback: mostPingsString,
										text: mostPingsString
									});
								}
								if (mostBombs) {

									var mostBombsString = 'Most bombs received from: <@' + SlackUserIdForMostBombs + '> :bomb:';
									attachments.push({
										attachment_type: 'default',
										mrkdwn_in: ["text", "pretext"],
										callback_id: "BOMBS_RECEIVED_FROM",
										fallback: mostBombsString,
										text: mostBombsString
									});
								}

								convo.say({
									text: text,
									attachments: attachments
								});
							})();
						}

						// pings sent from recap
						if (fromUserPings.length > 0) {
							(function () {

								var text = '';
								var attachments = [];
								var totalPingsFromCount = fromUserPings.length;
								var totalBombsFromCount = 0;

								var fromUserPingsContainer = { toUser: {} };

								fromUserPings.forEach(function (ping) {
									var _ping$dataValues2 = ping.dataValues;
									var ToUser = _ping$dataValues2.ToUser;
									var deliveryType = _ping$dataValues2.deliveryType;

									var ToUserSlackUserId = ToUser.dataValues.SlackUserId;

									var pingContainer = fromUserPingsContainer.toUser[ToUserSlackUserId] || { bombCount: 0, pingCount: 0 };
									pingContainer.pingCount++;
									if (deliveryType == _constants.constants.pingDeliveryTypes.bomb) {
										pingContainer.bombCount++;
										totalBombsFromCount++;
									}
									fromUserPingsContainer.toUser[ToUserSlackUserId] = pingContainer;
								});

								var SlackUserIdForMostBombs = void 0;
								var mostBombs = 0;
								var SlackUserIdForMostPings = void 0;
								var mostPings = 0;

								for (var ToUserSlackUserId in fromUserPingsContainer.toUser) {

									if (!fromUserPingsContainer.toUser.hasOwnProperty(ToUserSlackUserId)) {
										continue;
									}

									var pingContainer = fromUserPingsContainer.toUser[ToUserSlackUserId];
									var bombCount = pingContainer.bombCount;
									var pingCount = pingContainer.pingCount;


									if (bombCount > mostBombs) {
										mostBombs = bombCount;
										SlackUserIdForMostBombs = ToUserSlackUserId;
									}
									if (pingCount > mostPings) {
										mostPings = pingCount;
										SlackUserIdForMostPings = ToUserSlackUserId;
									}
								}

								var pingCountString = totalPingsFromCount == 1 ? '*' + totalPingsFromCount + '* ping' : '*' + totalPingsFromCount + '* pings';
								var bombCountString = totalBombsFromCount == 1 ? totalBombsFromCount + ' bomb' : totalBombsFromCount + ' bombs';
								text = 'You sent ' + pingCountString + ' today, including ' + bombCountString + ' that interrupted a team member\'s workflow:';

								if (mostPings > 0) {
									var mostPingsString = 'Most pings sent to: <@' + SlackUserIdForMostPings + '> :mailbox_closed:';
									attachments.push({
										attachment_type: 'default',
										mrkdwn_in: ["text", "pretext"],
										callback_id: "PINGS_SENT_TO",
										fallback: mostPingsString,
										text: mostPingsString
									});
								}
								if (mostBombs) {

									var mostBombsString = 'Most bombs sent to: <@' + SlackUserIdForMostBombs + '> :bomb:';
									attachments.push({
										attachment_type: 'default',
										mrkdwn_in: ["text", "pretext"],
										callback_id: "BOMBS_RECEIVED_FROM",
										fallback: mostBombsString,
										text: mostBombsString
									});
								}

								convo.say({
									text: text,
									attachments: attachments
								});
							})();
						}
					});
				});
			});
		});
	});
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map