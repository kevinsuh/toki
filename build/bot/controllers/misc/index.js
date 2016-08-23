'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * DEFAULT FALLBACK
  */
	controller.hears([''], 'direct_message', function (bot, message) {
		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			bot.reply(message, "Hey! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin");
		}, 500);
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map