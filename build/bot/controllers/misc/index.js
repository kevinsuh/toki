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

				convo.say('Hey! <@' + fromUserConfig.SlackUserId + '> wanted me to explain how I can also help you execute on your most meaningful things each day');
				convo.say('Think of me as an office manager for each of your teammate\'s attention. I help you easily enter work sessions, and protect your focus from others, *so that you only get interrupted with messages that are actually urgent*');
				convo.say('On the flip side, *I make it easy for you to ping teammates when they\'re actually ready to switch contexts.* This lets you get your requests out of your head when you think of them, and make sure it gets to the recipient without interrupting their current focus');
				convo.say({
					text: 'Here\'s how I specifically help you do this:',
					attachments: _constants.tokiExplainAttachments
				});
				convo.say('I\'m here whenever you\'re ready to go! Just let me know when you want to `ping` someone, or enter a `focus` session yourself :raised_hands:');

				convo.on('end', function (convo) {});
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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map