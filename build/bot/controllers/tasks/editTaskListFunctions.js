'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startEditTaskListMessage = startEditTaskListMessage;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// this one shows the task list message and asks for options
function startEditTaskListMessage(convo) {
	var _convo$tasksEdit = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit.dailyTasks;
	var bot = _convo$tasksEdit.bot;


	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	convo.say("Here are your tasks for today :memo::");
	convo.say(taskListMessage);

	askForTaskListOptions(convo);
	convo.next();
}

function askForTaskListOptions(convo) {

	convo.ask({
		text: 'What would you like to do?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "EDIT_TASKS",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "How do you want to edit tasks?",
			actions: [{
				name: _constants.buttonValues.addTasks.name,
				text: "Add tasks",
				value: _constants.buttonValues.addTasks.value,
				type: "button"
			}, {
				name: _constants.buttonValues.markComplete.name,
				text: "Complete :heavy_check_mark:",
				value: _constants.buttonValues.markComplete.value,
				type: "button"
			}, {
				name: _constants.buttonValues.editTaskTimes.name,
				text: "Edit times",
				value: _constants.buttonValues.editTaskTimes.value,
				type: "button"
			}, {
				name: _constants.buttonValues.deleteTasks.name,
				text: "Remove tasks",
				value: _constants.buttonValues.deleteTasks.value,
				type: "button",
				style: "danger"
			}, {
				name: _constants.buttonValues.neverMind.name,
				text: "Nothing!",
				value: _constants.buttonValues.neverMind.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.addTasks.value,
		callback: function callback(response, convo) {
			addTasksFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.addTasks.value
		pattern: _botResponses.utterances.containsAdd,
		callback: function callback(response, convo) {
			convo.say("Boom! Let's add some tasks :muscle:");
			addTasksFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.markComplete.value,
		callback: function callback(response, convo) {
			completeTasksFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.markComplete.value
		pattern: _botResponses.utterances.containsCompleteOrCheckOrCross,
		callback: function callback(response, convo) {
			convo.say("Woo! Let's cross off some tasks :grin:");
			completeTasksFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.deleteTasks.value,
		callback: function callback(response, convo) {
			deleteTasksFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.deleteTasks.value
		pattern: _botResponses.utterances.containsDeleteOrRemove,
		callback: function callback(response, convo) {
			convo.say("Let's do it!");
			deleteTasksFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.editTaskTimes.value,
		callback: function callback(response, convo) {
			editTaskTimesFlow(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.editTaskTimes.value
		pattern: _botResponses.utterances.containsTime,
		callback: function callback(response, convo) {
			convo.say("Let's do this :hourglass:");
			editTaskTimesFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.neverMindTasks.value,
		callback: function callback(response, convo) {
			convo.next();
		}
	}, { // NL equivalent to buttonValues.neverMind.value
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Okay! Keep at it :smile_cat:");
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

function addTasksFlow(response, convo) {
	var _convo$tasksEdit2 = convo.tasksEdit;
	var bot = _convo$tasksEdit2.bot;
	var dailyTasks = _convo$tasksEdit2.dailyTasks;
	var updateTaskListMessageObject = _convo$tasksEdit2.updateTaskListMessageObject;

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	var newTasks = [];
	dailyTasks.forEach(function (dailyTask) {
		newTasks.push(dailyTask);
	});
	// newTasks is just a copy of dailyTasks (you're saved tasks)
	convo.say('What tasks would you like to add to your list? Please send me each task in a separate line');
	convo.say("Then just tell me when you're `done`!");
	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "ADD_TASKS",
			fallback: "What tasks do you want to add?"
		}]
	}, [{ // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			console.log("BOT's SENT MESSAGES:");
			console.log(bot.sentMessages);
			console.log("\n\n\n\n");
			updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};
			newTasks.push(newTask);

			// everything except done!
			if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
				saveNewTaskResponses(newTasks, convo);
				convo.say("Excellent!");
				convo.next();
			} else {
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(newTasks);
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}
		}
	}]);

	convo.next();
}

function saveNewTaskResponses(newTasks, convo) {
	convo.say("NEW TASKS!!!");
	convo.next();
}

function completeTasksFlow(response, convo) {
	convo.say("~~ COMPLETING TASKS ~~");
	convo.next();
}

function deleteTasksFlow(response, convo) {
	convo.say("~~ DELETING TASKS ~~");
	convo.next();
}

function editTaskTimesFlow(response, convo) {
	convo.say("~~ EDITING TIME TO TASKS ~~");
	convo.next();
}
//# sourceMappingURL=editTaskListFunctions.js.map