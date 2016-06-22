'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	console.log("\n\n ~~ buttons controller initiated .. ~~ \n\n");

	// receive an interactive message via button click
	// check message.actions and message.callback_id to see the action to take
	controller.on('interactive_message_callback', function (bot, message) {

		console.log("\n\n\n ~~ inside interactive_message_callback ~~ \n\n\n");
		console.log(message);
		console.log("\n\n\n");

		bot.replyInteractive(message, {
			text: "...!?!?...",
			callback_id: "123",
			attachment_type: "default",
			actions: [{
				name: "another button!",
				text: "yay button",
				value: "yes ok",
				type: "button",
				style: "danger",
				confirm: {
					title: "You sure?",
					text: "This will do something!",
					ok_text: "Yesss",
					dismiss_text: "NAH!"
				}
			}]
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for "buttons" flow
//# sourceMappingURL=index.js.map