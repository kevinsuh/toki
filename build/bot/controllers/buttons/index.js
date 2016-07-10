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
				case _constants.buttonValues.changeTimeZone.value:
					bot.replyInteractive(message, "Let's change your timezone!");
					break;
				case _constants.buttonValues.changeName.value:
					bot.replyInteractive(message, "Let's change your name!");
					break;
				case _constants.buttonValues.neverMind.value:
					bot.replyInteractive(message, "Sounds good");
					break;
				case _constants.buttonValues.startDay.value:
					bot.replyInteractive(message, "Let's do it!");
					break;
				case _constants.buttonValues.startSession.value:
					bot.replyInteractive(message, ":boom: boom");
					break;
				case _constants.buttonValues.endDay.value:
					bot.replyInteractive(message, "It's about that time, isn't it?");
					break;
				case _constants.buttonValues.resetTimes.value:
					bot.replyInteractive(message, "_Resetting :repeat:..._");
					break;
				case _constants.buttonValues.doneSessionTimeoutYes.value:
					bot.replyInteractive(message, "Great work! :raised_hands:");
					controller.trigger('done_session_yes_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				case _constants.buttonValues.doneSessionTimeoutSnooze.value:
					_models2.default.User.find({
						where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
						include: [_models2.default.SlackUser]
					}).then(function (user) {
						bot.replyInteractive(message, 'Keep at it!');
						controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					});
					break;
				case _constants.buttonValues.doneSessionTimeoutDidSomethingElse.value:
					bot.replyInteractive(message, 'Woo! :ocean:');
					controller.trigger('end_session', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				case _constants.buttonValues.doneSessionTimeoutNo.value:
					bot.replyInteractive(message, 'That\'s okay! You can keep chipping away and you\'ll get there :pick:');
					controller.trigger('done_session_no_flow', [bot, { SlackUserId: SlackUserId, botCallback: true }]);
					break;
				case _constants.buttonValues.doneSessionYes.value:
					bot.replyInteractive(message, "Great work! :raised_hands:");
					break;
				case _constants.buttonValues.doneSessionSnooze.value:
					bot.replyInteractive(message, 'Keep at it!');
					break;
				case _constants.buttonValues.doneSessionDidSomethingElse.value:
					bot.replyInteractive(message, ':ocean: Woo!');
					break;
				case _constants.buttonValues.doneSessionNo.value:
					bot.replyInteractive(message, 'That\'s okay! You can keep chipping away and you\'ll get there :pick:');
					break;
				case _constants.buttonValues.thatsCorrect.value:
					bot.replyInteractive(message, 'Fantastic!');
					break;
				case _constants.buttonValues.thatsIncorrect.value:
					bot.replyInteractive(message, 'Oops, okay! Let\'s get this right');
					break;
				case _constants.buttonValues.addTask.value:
					bot.replyInteractive(message, 'Added! Keep at it :muscle:');
					break;
				case _constants.buttonValues.changeTaskContent.value:
					bot.replyInteractive(message, 'Let\'s change the task then!');
					break;
				case _constants.buttonValues.changeTaskTime.value:
					bot.replyInteractive(message, 'Let\'s change the time then!');
					break;
				case _constants.buttonValues.editTaskList.value:
					bot.replyInteractive(message, 'Okay! Let\'s edit your task list');
					break;
				case _constants.buttonValues.addTasks.value:
					bot.replyInteractive(message, 'Boom! Let\'s add some tasks :muscle:');
					break;
				case _constants.buttonValues.markComplete.value:
					bot.replyInteractive(message, 'Woo! Let\'s check off some tasks :grin:');
					break;
				case _constants.buttonValues.deleteTasks.value:
					bot.replyInteractive(message, 'Okay! Let\'s remove some tasks ');
					break;
				case _constants.buttonValues.neverMindTasks.value:
					bot.replyInteractive(message, "Okay! Keep at it :smile_cat:");
					break;
				case _constants.buttonValues.editTaskTimes.value:
					bot.replyInteractive(message, "Let's do this :hourglass:");
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

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for "buttons" flow
//# sourceMappingURL=index.js.map