'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.hears([_constants.constants.THANK_YOU.reg_exp], 'direct_message', function (bot, message) {
		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			bot.reply(message, "You're welcome!! :smile:");
			(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
		}, 500);
	});

	/**
  * DEFAULT FALLBACK
  */
	controller.hears([_constants.constants.ANY_CHARACTER.reg_exp], 'direct_message', function (bot, message) {
		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			bot.reply(message, "Hey! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin");
			(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
		}, 500);
	});

	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', _index.wit.hears, function (bot, message) {

		if (message.text && message.text[0] == "/") {
			// ignore all slash commands
			console.log("\n\n ~~ ignoring a slash command ~~ \n\n");
			return;
		}

		var SlackUserId = message.user;

		(0, _miscHelpers.consoleLog)("in back up area!!!", message);

		var SECRET_KEY = new RegExp(/^TOKI_T1ME/);

		// user said something outside of wit's scope
		if (!message.selectedIntent) {

			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(function () {

				// different fallbacks based on reg exp
				var text = message.text;


				if (_constants.constants.THANK_YOU.reg_exp.test(text)) {
					// user says thank you
					bot.reply(message, "You're welcome!! :smile:");
				} else if (SECRET_KEY.test(text)) {

					(0, _miscHelpers.consoleLog)("UNLOCKED TOKI_T1ME!!!");
					/*
     		
     *** ~~ TOP SECRET PASSWORD FOR TESTING FLOWS ~~ ***
     		
      */
					controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
				} else {
					// end-all fallback
					var options = [{ title: 'start a day', description: 'get started on your day' }, { title: 'start a session', description: 'start a work session with me' }, { title: 'end session early', description: 'end your current work session with me' }];
					var colorsArrayLength = _constants.colorsArray.length;
					var optionsAttachment = options.map(function (option, index) {
						var colorsArrayIndex = index % colorsArrayLength;
						return {
							fields: [{
								title: option.title,
								value: option.description
							}],
							color: _constants.colorsArray[colorsArrayIndex].hex,
							attachment_type: 'default',
							callback_id: "SHOW OPTIONS",
							fallback: option.description
						};
					});

					bot.reply(message, {
						text: "Hey! I'm here to help you with your 3 priorities for today. Let me know when you want to get started."
					});
				}

				(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
			}, 1000);
		}
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

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map