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

		var replyMessage = "I'm not sure what you mean by that :thinking_face:";

		var config = { SlackUserId: SlackUserId };

		// some fallbacks for button clicks
		switch (text) {
			case (text.match(_constants.utterances.keepWorking) || {}).input:
				controller.trigger('current_session_status', [bot, config]);
				break;
			default:
				// bot.reply(message, replyMessage);
				controller.trigger('current_session_status', [bot, config]);
				break;
		}
	});

	controller.on('explain_toki_flow', function (bot, config) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var fromUserConfig = config.fromUserConfig;
		var toUserConfig = config.toUserConfig;
		var explainToSelf = config.explainToSelf;
		var UserConfig = config.UserConfig;


		if (explainToSelf) {
			toUserConfig = UserConfig;
		}

		_models2.default.User.find({
			where: { SlackUserId: toUserConfig.SlackUserId }
		}).then(function (toUser) {
			var SlackUserId = toUser.SlackUserId;


			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				// have 5-minute exit time limit
				if (convo) convo.task.timeLimit = 1000 * 60 * 5;

				if (!explainToSelf) {
					convo.say('Hey! <@' + fromUserConfig.SlackUserId + '> wanted me to explain how I can also help you get your most meaningful things done each day');
				} else {
					convo.say('Hope you\'re having a great day so far, <@' + SlackUserId + '>!');
				}

				convo.say('Think of me as an office manager for each of your teammate\'s attention. *I share your current priority to your team*, so that you can work without getting pulled to switch contexts');
				convo.say('On the flip side, *I also make it easy for you to ping teammates at the right times.* This lets you get requests out of your head when you think of them, while making sure it doesn\'t unnecessarily interrupt anyone\'s flow');
				convo.say({
					text: 'Here\'s how I do this:',
					attachments: _constants.tokiExplainAttachments
				});
				convo.say('I\'m here whenever you\'re ready to go! Just let me know when you want to `/ping` someone, or enter a `/priority` session yourself :raised_hands:');

				convo.on('end', function (convo) {});
			});
		});
	});

	controller.on('daily_recap_flow', function (bot, config) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = config.SlackUserId;
		var fromThisDateTime = config.fromThisDateTime;

		var now = (0, _momentTimezone2.default)();

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var tz = user.tz;
			var dailyRecapTime = user.dailyRecapTime;

			var UserId = user.id;

			// i.e. `You sent 5 pings today`
			// vs `You sent 5 pings since Friday`
			var sinceDayString = 'today';
			if (Math.round(_momentTimezone2.default.duration(now.diff(fromThisDateTime)).asDays()) == 1) {
				var day = fromThisDateTime.tz(tz).format('dddd');
				sinceDayString = 'yesterday';
			} else if (Math.round(_momentTimezone2.default.duration(now.diff(fromThisDateTime)).asDays()) > 1) {
				var _day = fromThisDateTime.tz(tz).format('dddd');
				sinceDayString = 'since ' + _day;
			}

			var dailyRecapTimeObject = (0, _momentTimezone2.default)(dailyRecapTime).tz(tz);

			var fromThisDateTimeString = fromThisDateTime.format("YYYY-MM-DD HH:mm:ss Z");
			user.getSessions({
				where: ['"startTime" > ?', fromThisDateTimeString],
				order: '("Session"."endTime" - "Session"."startTime") DESC'
			}).then(function (sessions) {

				_models2.default.Ping.findAll({
					where: ['("Ping"."ToUserId" = ? OR "Ping"."FromUserId" = ?) AND "Ping"."createdAt" > ?', UserId, UserId, fromThisDateTimeString],
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

						if (sessions.length > 0 || toUserPings.length > 0 || fromUserPings.length > 0) {
							convo.say('Hey <@' + SlackUserId + '>!');
						}

						// sessions recap
						if (sessions.length > 0) {
							(function () {

								var text = '';
								var totalTimeInSessions = 0;
								var fields = [{
									title: 'Priority',
									short: true
								}, {
									title: 'Time',
									short: true
								}];

								sessions.forEach(function (session) {
									var content = session.content;
									var startTime = session.startTime;
									var endTime = session.endTime;


									var startTimeObject = (0, _momentTimezone2.default)(startTime).tz(tz);
									var endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
									var sessionMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(startTimeObject)).asMinutes());
									var sessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(sessionMinutes);

									totalTimeInSessions += sessionMinutes;

									// 1. add priority
									fields.push({
										value: '`' + content + '`',
										short: true
									});

									// 2. add amount of time
									fields.push({
										value: '' + sessionTimeString,
										short: true
									});
								});

								var totalTimeInSessionsString = (0, _messageHelpers.convertMinutesToHoursString)(totalTimeInSessions);
								text = 'You spent *' + totalTimeInSessionsString + '* on your priorities with me ' + sinceDayString + '. Here\'s a quick breakdown of what you spent your time on:';

								var attachments = [{
									attachment_type: 'default',
									mrkdwn_in: ["text", "pretext", "fields"],
									callback_id: "SESSION_INFO",
									color: _constants.colorsHash.toki_purple.hex,
									fallback: text,
									fields: fields
								}];

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
								var fields = [];
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
								text = 'You received ' + pingCountString + ' ' + sinceDayString + ', including ' + bombCountString + ' that interrupted your workflow:';

								if (mostPings > 0) {
									var mostPingsString = 'Most pings received from: <@' + SlackUserIdForMostPings + '> :mailbox_closed:';
									fields.push({
										value: mostPingsString
									});
								}
								if (mostBombs) {
									var mostBombsString = 'Most bombs received from: <@' + SlackUserIdForMostBombs + '> :bomb:';
									fields.push({
										value: mostBombsString
									});
								}

								var convoResponseObject = { text: text };
								if (fields.length > 0) {
									var _attachments = [{
										attachment_type: 'default',
										mrkdwn_in: ["text", "pretext", "fields"],
										callback_id: "PINGS_BOMBS_RECEIVED_FROM",
										fallback: text,
										fields: fields
									}];
									convoResponseObject.attachments = _attachments;
								}

								convo.say(convoResponseObject);
							})();
						}

						// pings sent from recap
						if (fromUserPings.length > 0) {
							(function () {

								var text = '';
								var fields = [];
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
								text = 'You sent ' + pingCountString + ' ' + sinceDayString + ', including ' + bombCountString + ' that interrupted a team member\'s workflow:';

								if (mostPings > 0) {
									var mostPingsString = 'Most pings sent to: <@' + SlackUserIdForMostPings + '> :mailbox_closed:';
									fields.push({
										value: mostPingsString
									});
								}
								if (mostBombs) {

									var mostBombsString = 'Most bombs sent to: <@' + SlackUserIdForMostBombs + '> :bomb:';
									fields.push({
										value: mostBombsString
									});
								}

								var convoResponseObject = { text: text };
								if (fields.length > 0) {
									var _attachments2 = [{
										attachment_type: 'default',
										mrkdwn_in: ["text", "pretext", "fields"],
										callback_id: "PINGS_BOMBS_SENT_TO",
										fallback: text,
										fields: fields
									}];
									convoResponseObject.attachments = _attachments2;
								}

								convo.say(convoResponseObject);
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