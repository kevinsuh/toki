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
					bot.replyInteractive(message, "I'd love to check in with you! Leave a note in the same line if you want me to remember it (`i.e. halfway done by 4pm`)");
					break;
				case _constants.buttonValues.changeTask.value:
					bot.replyInteractive(message, "Let's give this another try then :repeat_one:");
					break;
				case _constants.buttonValues.changeSessionTime.value:
					// this is when you want to have a custom time
					bot.replyInteractive(message, "Let's choose how long to work! I understand minutes (`ex. 45 min`) or specific times (`ex. 3:15pm`)");
					break;
				case _constants.buttonValues.changeCheckinTime.value:
					bot.replyInteractive(message, "I'm glad we caught this - when would you like me to check in with you?");
					break;
				case _constants.buttonValues.newTask.value:
					bot.replyInteractive(message, "Sweet! Let's work on a new task");
					break;
				case _constants.buttonValues.addCheckinNote.value:
					bot.replyInteractive(message, "Let's add a note to your checkin!");
					break;
				case _constants.buttonValues.takeBreak.value:
					bot.replyInteractive(message, "Let's take a break!");
					break;
				case _constants.buttonValues.noTasks.value:
					bot.replyInteractive(message, "No worries! :smile_cat:");
					break;
				case _constants.buttonValues.noPendingTasks.value:
					bot.replyInteractive(message, "I like a fresh start each day, too :tangerine:");
					break;
				case _constants.buttonValues.noAdditionalTasks.value:
					bot.replyInteractive(message, "Sounds good!");
					break;
				case _constants.buttonValues.backLater.value:
					bot.replyInteractive(message, "Okay! I'll be here when you get back");
					break;
				case _constants.buttonValues.actuallyWantToAddATask.value:
					bot.replyInteractive(message, "Of course - just add another task here and say `done` when you're ready to go");
					break;
				case _constants.buttonValues.differentTask.value:
					bot.replyInteractive(message, "What did you get done instead?");
					break;
				case _constants.buttonValues.keepName.value:
					bot.replyInteractive(message, "Cool!");
					break;
				case _constants.buttonValues.differentName.value:
					bot.replyInteractive(message, "Let's do another name then!");
					break;
				default:
					// some default to replace button no matter what
					bot.replyInteractive(message, "Awesome!");
			}
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

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for "buttons" flow
//# sourceMappingURL=index.js.map