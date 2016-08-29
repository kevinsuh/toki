'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.hears(['^{'], 'direct_message', _hearsMiddleware.isJsonObject, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		console.log('\n\n text: ');
		console.log(text);

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			try {
				var jsonObject = JSON.parse(text);
				var sendBomb = jsonObject.sendBomb;
				var pingId = jsonObject.pingId;

				if (sendBomb) {
					bot.reply(message, 'You tryna send a bomb to ping id: ' + pingId);
				}
			} catch (error) {
				// this should never happen!
				bot.reply(message, "Hmm, something went wrong");
				return false;
			}
		}, 500);
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

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _hearsMiddleware = require('../../middleware/hearsMiddleware');

var _constants = require('../../lib/constants');

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map