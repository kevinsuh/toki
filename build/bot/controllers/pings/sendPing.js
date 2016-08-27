'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *
  * 		User directly asks to ping
  * 							~* via Wit *~
  */
	controller.hears(['ping'], 'direct_message', _index.wit.hears, function (bot, message) {
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

		var config = {
			SlackUserId: SlackUserId,
			message: message,
			pingSlackUserIds: pingSlackUserIds
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('ping_flow', [bot, config]);
		}, 650);
	});

	controller.hears(['^pin[ng]{1,4}'], 'direct_message', function (bot, message) {
		var _message$intentObject2 = message.intentObject.entities;
		var intent = _message$intentObject2.intent;
		var reminder = _message$intentObject2.reminder;
		var duration = _message$intentObject2.duration;
		var datetime = _message$intentObject2.datetime;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;

		var pingSlackUserIds = (0, _messageHelpers.getUniqueSlackUsersFromString)(text);

		var config = {
			SlackUserId: SlackUserId,
			message: message,
			pingSlackUserIds: pingSlackUserIds
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('ping_flow', [bot, config]);
		}, 650);
	});

	/**
  * 		ACTUAL PING FLOW
  * 		this will begin the ping flow with user
  */
	controller.on('ping_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var message = config.message;
		var pingSlackUserIds = config.pingSlackUserIds;


		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var tz = user.tz;

			var UserId = user.id;

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				// have 5-minute exit time limit
				if (convo) convo.task.timeLimit = 1000 * 60 * 5;

				convo.pingObject = {
					SlackUserId: SlackUserId,
					bot: bot,
					tz: tz,
					pingSlackUserIds: pingSlackUserIds
				};

				(0, _pingFunctions.startPingFlow)(convo);

				convo.on('end', function (convo) {
					var _convo$pingObject = convo.pingObject;
					var SlackUserId = _convo$pingObject.SlackUserId;
					var tz = _convo$pingObject.tz;
					var pingUserId = _convo$pingObject.pingUserId;
					var pingSlackUserId = _convo$pingObject.pingSlackUserId;
					var pingTimeObject = _convo$pingObject.pingTimeObject;
					var userInSession = _convo$pingObject.userInSession;
					var deliveryType = _convo$pingObject.deliveryType;
					var pingMessages = _convo$pingObject.pingMessages;


					var fromUserConfig = { UserId: UserId, SlackUserId: SlackUserId };
					var toUserConfig = { UserId: pingUserId, SlackUserId: pingSlackUserId };
					var config = { userInSession: userInSession, deliveryType: deliveryType, pingTimeObject: pingTimeObject, pingMessages: pingMessages };
					queuePing(bot, fromUserConfig, toUserConfig, config);
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

var _pingFunctions = require('./pingFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=sendPing.js.map