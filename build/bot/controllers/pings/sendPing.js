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


				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("PINGED!");
				});
			});
		}, 750);
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
		console.log("\n\n ~~ \n\n\n");
		console.log(text);
		console.log(pingSlackUserIds);
		console.log("\n\n ~~ \n\n\n");

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


				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("PINGED!");
				});
			});
		}, 750);
	});

	/**
  * 		ACTUAL PING FLOW
  * 		this will begin the ping flow with user
  */
	controller.on('ping_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var content = config.content;
		var minutes = config.minutes;
		var changeTimeAndTask = config.changeTimeAndTask;


		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {});
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
//# sourceMappingURL=sendPing.js.map