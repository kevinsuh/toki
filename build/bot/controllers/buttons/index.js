'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// receive an interactive message via button click
	// check message.actions and message.callback_id to see the action to take
	controller.on('interactive_message_callback', function (bot, message) {

		console.log("\n\n\n ~~ inside interactive_message_callback ~~ \n");
		console.log("this is message:");
		console.log(message);
		console.log("\n\n\n");

		var SlackUserId = message.user;
		var actions = message.actions;
		var callback_id = message.callback_id;

		// need to replace buttons so user cannot reclick it

		if (actions && actions.length > 0) {
			switch (actions[0].value) {
				case _constants.buttonValues.startNow.value:
					bot.replyInteractive(message, "Boom! :boom:");
					break;
				case _constants.buttonValues.checkIn.value:
					bot.replyInteractive(message, "Sure thing! Leave a note in the same line if you want me to remind you about something specific");
					break;
				case _constants.buttonValues.changeTask.value:
					bot.replyInteractive(message, "Let's give this another try then :repeat_one:");
					break;
				case _constants.buttonValues.changeSessionTime.value:
					// this is when you want to have a custom time
					bot.replyInteractive(message, "Sure thing! I understand minutes (`ex. 45 min`) or specific times (`ex. 3:15pm`)");
					break;
				case _constants.buttonValues.changeCheckinTime.value:
					bot.replyInteractive(message, "I'm glad we caught this - when would you like me to check in with you?");
					break;
				default:
					// some default to replace button no matter what
					bot.replyInteractive(message, "Awesome, thanks!");
			}
		}

		// if (callback_id == "test" && actions.length > 0) {
		// 	const { name, value } = actions[0];
		// 	console.log("callback!");
		// 	console.log(actions);

		// 	if (value == "QUIT_START_DAY") {
		// 		bot.replyInteractive(message, "restarting start day!");
		// 		controller.trigger('trigger_day_start', [bot, { SlackUserId }]);
		// 	}
		// }
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

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for "buttons" flow
//# sourceMappingURL=index.js.map