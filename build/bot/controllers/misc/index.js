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
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map