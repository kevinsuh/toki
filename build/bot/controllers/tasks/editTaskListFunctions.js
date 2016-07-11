'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

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
				name: _constants.buttonValues.neverMindTasks.name,
				text: "Nothing!",
				value: _constants.buttonValues.neverMindTasks.value,
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
			convo.say("Okay, let's add some tasks :muscle:");
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

	// tasks is just a copy of dailyTasks (you're saved tasks)
	convo.say('What tasks would you like to add to your list? Please send me each task in a separate line');
	convo.say("Then just tell me when you're `done`!");
	askWhichTasksToAdd(response, convo);
	convo.next();
}

function askWhichTasksToAdd(response, convo) {
	var _convo$tasksEdit2 = convo.tasksEdit;
	var bot = _convo$tasksEdit2.bot;
	var dailyTasks = _convo$tasksEdit2.dailyTasks;
	var updateTaskListMessageObject = _convo$tasksEdit2.updateTaskListMessageObject;

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	var tasks = [];
	dailyTasks.forEach(function (dailyTask) {
		tasks.push(dailyTask);
	});

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

			updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};

			// everything except done!
			if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
				saveNewTaskResponses(tasks, convo);
				convo.say("Excellent!");
				getTimeToNewTasks(response, convo);
				convo.next();
			} else {
				tasks.push(newTask);
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(tasks);
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}
		}
	}]);
}

function saveNewTaskResponses(tasks, convo) {

	// get the newTasks!
	var dailyTasks = convo.tasksEdit.dailyTasks;


	if (tasks) {

		// only get the new tasks
		var newTasks = [];
		tasks.forEach(function (task) {
			if (task.newTask) {
				newTasks.push(task);
			}
		});
		var newTasksArray = (0, _messageHelpers.convertResponseObjectsToTaskArray)(newTasks);
		if (!dailyTasks) {
			dailyTasks = [];
		}

		convo.tasksEdit.dailyTasks = dailyTasks; // all daily tasks
		convo.tasksEdit.newTasks = newTasksArray; // only the new ones
	}

	convo.next();
}

function getTimeToNewTasks(response, convo) {
	var _convo$tasksEdit3 = convo.tasksEdit;
	var bot = _convo$tasksEdit3.bot;
	var dailyTasks = _convo$tasksEdit3.dailyTasks;
	var newTasks = _convo$tasksEdit3.newTasks;

	var options = { dontShowMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(newTasks, options);

	convo.say("How much time would you like to allocate to your new tasks?");

	var timeToTasksArray = [];
	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "ADD_TIME_TO_NEW_TASKS",
			fallback: "What are the times to your new tasks?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.actuallyWantToAddATask.name,
				text: "Add more tasks!",
				value: _constants.buttonValues.actuallyWantToAddATask.value,
				type: "button"
			}, {
				name: _constants.buttonValues.resetTimes.name,
				text: "Reset times",
				value: _constants.buttonValues.resetTimes.value,
				type: "button",
				style: "danger"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.actuallyWantToAddATask.value,
		callback: function callback(response, convo) {
			askWhichTasksToAdd(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.resetTimes.value,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
				// reset ze task list message
				timeToTasksArray = [];
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(newTasks, { dontShowMinutes: true });
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}

			convo.silentRepeat();
		}
	}, {
		pattern: _constants.RESET.reg_exp,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
				// reset ze task list message
				timeToTasksArray = [];
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(newTasks, { dontShowMinutes: true });
				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}

			convo.silentRepeat();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getUpdateTaskListMessageObject)(response.channel, bot);

			if (updateTaskListMessageObject) {
				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
				var comma = new RegExp(/[,]/);
				var validMinutesTester = new RegExp(/[\dh]/);
				var timeToTasks = response.text.split(comma);

				timeToTasks.forEach(function (time) {
					if (validMinutesTester.test(time)) {
						var minutes = (0, _messageHelpers.convertTimeStringToMinutes)(time);
						timeToTasksArray.push(minutes);
					}
				});

				newTasks = newTasks.map(function (task, index) {
					if (task.dataValues) {
						// task from DB
						return _extends({}, task, {
							minutes: timeToTasksArray[index],
							text: task.dataValues.text
						});
					}
					return _extends({}, task, {
						minutes: timeToTasksArray[index]
					});
				});

				var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(newTasks, { dontUseDataValues: true, emphasizeMinutes: true });

				updateTaskListMessageObject.text = taskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}

			if (timeToTasksArray.length >= newTasks.length) {
				convo.tasksEdit.newTasks = newTasks;
				confirmTimeToTasks(response, convo);
				convo.next();
			}
		}
	}]);
}

function confirmTimeToTasks(response, convo) {

	convo.ask("Are those times right?", [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			addNewTasksToTaskList(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Let's give this another try :repeat_one:");
			convo.say("Just say time estimates, like `30, 1 hour, or 15 min` and I'll figure it out and assign times to the tasks above in order :smiley:");
			getTimeToNewTasks(response, convo);
			convo.next();
		}
	}]);
}

function addNewTasksToTaskList(response, convo) {
	// combine the newTasks with dailyTasks
	var _convo$tasksEdit4 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit4.dailyTasks;
	var newTasks = _convo$tasksEdit4.newTasks;

	var options = {};

	var taskArray = [];
	dailyTasks.forEach(function (task) {
		taskArray.push(task);
	});
	newTasks.forEach(function (newTask) {
		taskArray.push(newTask);
	});

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	convo.say("This looks great! Here's your updated task list :memo::");
	convo.say(taskListMessage);
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