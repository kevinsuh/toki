'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.on('user_channel_join', function (bot, message) {

		if (message && message.channel) {
			var channel = message.channel;

			(0, _slackHelpers.updateDashboardForChannelId)(bot, channel);
		}
	});

	controller.on('channel_leave', function (bot, message) {

		if (message && message.channel) {
			var channel = message.channel;

			(0, _slackHelpers.updateDashboardForChannelId)(bot, channel);
		}
	});

	// this is for updating ping functionality
	controller.hears(['^{'], 'direct_message', _hearsMiddleware.isJsonObject, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		try {

			var jsonObject = JSON.parse(text);
			var overrideNewSession = jsonObject.overrideNewSession;
			var updatePing = jsonObject.updatePing;
			var cancelPing = jsonObject.cancelPing;
			var sendBomb = jsonObject.sendBomb;
			var PingId = jsonObject.PingId;

			var config = {};
			if (updatePing) {
				config = { PingId: PingId, sendBomb: sendBomb, cancelPing: cancelPing };
				controller.trigger('update_ping_message', [bot, config]);
			} else if (overrideNewSession) {
				config = { SlackUserId: SlackUserId, changeTimeAndTask: true };
				controller.trigger('begin_session_flow', [bot, null, config]);
			}
		} catch (error) {

			console.log(error);

			// this should never happen!
			bot.reply(message, "Hmm, something went wrong");
			return false;
		}
	});

	/**
  * 	This is where we handle "Send Message" button and other buttons in dashboard
  * 	Give `direct_message` precedence above: if it is DM it will get picked up before this catch-all `ambient`
  */
	controller.hears(['^{'], 'ambient', _hearsMiddleware.isJsonObject, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		try {

			var jsonObject = JSON.parse(text);
			var setPriority = jsonObject.setPriority;
			var pingUser = jsonObject.pingUser;
			var PingToSlackUserId = jsonObject.PingToSlackUserId;

			var config = {};
			if (pingUser) {
				config = { SlackUserId: SlackUserId, pingSlackUserIds: [PingToSlackUserId] };
				controller.trigger('ping_flow', [bot, null, config]);
			} else if (setPriority) {
				config = { SlackUserId: SlackUserId };
				controller.trigger('begin_session_flow', [bot, null, config]);
			}
		} catch (error) {

			console.log(error);

			// this should never happen!
			bot.reply(message, "Hmm, something went wrong");
			return false;
		}
	});

	// defer ping!
	controller.hears([_constants.utterances.deferPing], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		controller.trigger('defer_ping_flow', [bot, message]);
	});

	// cancel ping!
	controller.hears([_constants.utterances.cancelPing], 'direct_message', function (bot, message) {

		console.log('\n\n huh');

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		controller.trigger('cancel_ping_flow', [bot, message]);
	});

	controller.hears([_constants.utterances.sendSooner], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		controller.trigger('send_sooner_flow', [bot, message]);
	});

	controller.hears([_constants.constants.THANK_YOU.reg_exp], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		bot.reply(message, "You're welcome!! :smile:");
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
		var config = { SlackUserId: SlackUserId, changeTimeAndTask: true };
		controller.trigger('begin_session_flow', [bot, message, config]);
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

var _slackHelpers = require('../../lib/slackHelpers');

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map