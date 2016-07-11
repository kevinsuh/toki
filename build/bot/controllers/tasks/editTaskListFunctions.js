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


	var options = { segmentCompleted: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

	convo.say("Here are your tasks for today :memo::");
	convo.say({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list!"
		}]
	});

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

/**
 * 			~~ ADD TASKS FLOW ~~
 */

function addTasksFlow(response, convo) {

	// tasks is just a copy of dailyTasks (you're saved tasks)
	askWhichTasksToAdd(response, convo);
	convo.next();
}

function askWhichTasksToAdd(response, convo) {
	var _convo$tasksEdit2 = convo.tasksEdit;
	var bot = _convo$tasksEdit2.bot;
	var dailyTasks = _convo$tasksEdit2.dailyTasks;
	var newTasks = _convo$tasksEdit2.newTasks;
	var actuallyWantToAddATask = _convo$tasksEdit2.actuallyWantToAddATask;

	var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);

	var tasksToAdd = [];
	convo.ask({
		text: "What other tasks do you want to work on?",
		attachments: [{
			attachment_type: 'default',
			callback_id: "ADD_TASKS",
			fallback: "What tasks do you want to add?"
		}]
	}, [{ // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};

			// everything except done!
			if (_constants.FINISH_WORD.reg_exp.test(response.text)) {
				saveNewTaskResponses(tasksToAdd, convo);
				convo.say("Excellent!");
				getTimeToNewTasks(response, convo);
				convo.next();
			} else {

				tasksToAdd.push(newTask);
				var taskArray = [];
				newTasks.forEach(function (task) {
					taskArray.push(task);
				});
				tasksToAdd.forEach(function (task) {
					taskArray.push(task);
				});

				var fullTaskListMessage = '';
				if (actuallyWantToAddATask) {
					var options = { dontCalculateMinutes: true };
					fullTaskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);
				} else {
					var options = { segmentCompleted: true, newTasks: taskArray };
					fullTaskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);
				}

				updateTaskListMessageObject.text = fullTaskListMessage;
				bot.api.chat.update(updateTaskListMessageObject);
			}
		}
	}]);
}

function saveNewTaskResponses(tasksToAdd, convo) {

	// get the newTasks!
	var _convo$tasksEdit3 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit3.dailyTasks;
	var newTasks = _convo$tasksEdit3.newTasks;


	if (tasksToAdd) {

		// only get the new tasks
		var tasksArray = [];
		tasksToAdd.forEach(function (task) {
			if (task.newTask) {
				tasksArray.push(task);
			}
		});
		var tasksToAddArray = (0, _messageHelpers.convertResponseObjectsToTaskArray)(tasksArray);
		if (!dailyTasks) {
			dailyTasks = [];
		}

		tasksToAddArray.forEach(function (newTask) {
			newTasks.push(newTask);
		});

		convo.tasksEdit.dailyTasks = dailyTasks; // all daily tasks
		convo.tasksEdit.newTasks = newTasks; // only the new ones
	}

	convo.next();
}

function getTimeToNewTasks(response, convo) {
	var _convo$tasksEdit4 = convo.tasksEdit;
	var bot = _convo$tasksEdit4.bot;
	var dailyTasks = _convo$tasksEdit4.dailyTasks;
	var newTasks = _convo$tasksEdit4.newTasks;

	var options = { dontShowMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(newTasks, options);

	var timeToTasksArray = [];

	convo.say({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list!"
		}]
	});

	convo.ask({
		text: "How much time would you like to allocate to your new tasks?",
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
			convo.tasksEdit.actuallyWantToAddATask = true;
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
	var _convo$tasksEdit5 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit5.dailyTasks;
	var newTasks = _convo$tasksEdit5.newTasks;

	var options = { segmentCompleted: true };

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

/**
 * 			~~ COMPLETE TASKS FLOW ~~
 */

function completeTasksFlow(response, convo) {
	var dailyTasks = convo.tasksEdit.dailyTasks;

	var message = 'Which of your task(s) above would you like to complete?';

	convo.ask(message, [{
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Okay, let me know if you still want to `edit tasks`");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			confirmCompleteTasks(response, convo);
			convo.next();
		}
	}]);

	convo.next();
}

function confirmCompleteTasks(response, convo) {

	var tasksToCompleteString = response.text;
	var _convo$tasksEdit6 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit6.dailyTasks;
	var dailyTaskIdsToComplete = _convo$tasksEdit6.dailyTaskIdsToComplete;

	// if we capture 0 valid tasks from string, then we start over

	var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksToCompleteString, dailyTasks);
	if (!taskNumbersToCompleteArray) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("Please pick tasks from your list like `tasks 1, 3 and 4` or say `never mind`");
		var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
		convo.say(taskListMessage);
		completeTasksFlow(response, convo);
		return;
	}

	var dailyTasksToComplete = [];
	dailyTasks.forEach(function (dailyTask, index) {
		var taskNumber = index + 1; // b/c index is 0-based
		if (taskNumbersToCompleteArray.indexOf(taskNumber) > -1) {
			dailyTasksToComplete.push(dailyTask);
		}
	});

	var dailyTaskTextsToComplete = dailyTasksToComplete.map(function (dailyTask) {
		return dailyTask.dataValues.Task.text;
	});

	var taskListMessage = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTextsToComplete);

	convo.ask('So you would like to complete ' + taskListMessage + '?', [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.say("Sounds great, checked off :white_check_mark:!");

			// add to delete array for tasksEdit
			dailyTaskIdsToComplete = dailyTasksToComplete.map(function (dailyTask) {
				return dailyTask.dataValues.id;
			});
			convo.tasksEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;

			updateCompleteTaskListMessage(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Okay, let me know if you still want to `edit tasks`");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			convo.say("Couldn't quite catch that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

function updateCompleteTaskListMessage(response, convo) {
	var _convo$tasksEdit7 = convo.tasksEdit;
	var bot = _convo$tasksEdit7.bot;
	var dailyTasks = _convo$tasksEdit7.dailyTasks;
	var dailyTaskIdsToComplete = _convo$tasksEdit7.dailyTaskIdsToComplete;

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

	// spit back updated task list
	var taskArray = [];
	var fullTaskArray = []; // this one will have all daily tasks but with ~completed~ updated
	dailyTasks.forEach(function (dailyTask, index) {
		var id = dailyTask.dataValues.id;

		if (dailyTaskIdsToComplete.indexOf(id) < 0) {
			// daily task is NOT in the ids to delete
			taskArray.push(dailyTask);
		} else {
			dailyTask.dataValues.done = true; // semi hack
		}
		fullTaskArray.push(dailyTask);
	});

	var options = { segmentCompleted: true };
	var fullTaskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(fullTaskArray, options);

	convo.say("Here's the rest of your task list for today :memo::");
	convo.say(fullTaskListMessage);

	// should ask if ready for session

	convo.next();
}

/**
 * 			~~ DELETE TASKS FLOW ~~
 */

function deleteTasksFlow(response, convo) {
	var dailyTasks = convo.tasksEdit.dailyTasks;

	var message = 'Which of your task(s) above would you like to delete?';

	convo.ask(message, [{
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Okay, let me know if you still want to `edit tasks`");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			confirmDeleteTasks(response, convo);
			convo.next();
		}
	}]);

	convo.next();
}

function confirmDeleteTasks(response, convo) {

	var tasksToDeleteString = response.text;
	var _convo$tasksEdit8 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit8.dailyTasks;
	var dailyTaskIdsToDelete = _convo$tasksEdit8.dailyTaskIdsToDelete;

	// if we capture 0 valid tasks from string, then we start over

	var taskNumbersToDeleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksToDeleteString, dailyTasks);
	if (!taskNumbersToDeleteArray) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("Please pick tasks from your list like `tasks 1, 3 and 4` or say `never mind`");
		var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
		convo.say(taskListMessage);
		deleteTasksFlow(response, convo);
		return;
	}

	var dailyTasksToDelete = [];
	dailyTasks.forEach(function (dailyTask, index) {
		var taskNumber = index + 1; // b/c index is 0-based
		if (taskNumbersToDeleteArray.indexOf(taskNumber) > -1) {
			dailyTasksToDelete.push(dailyTask);
		}
	});

	var dailyTaskTextsToDelete = dailyTasksToDelete.map(function (dailyTask) {
		return dailyTask.dataValues.Task.text;
	});

	var taskListMessage = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTextsToDelete);

	convo.ask('So you would like to delete ' + taskListMessage + '?', [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.say("Sounds great, deleted!");

			// add to delete array for tasksEdit
			dailyTaskIdsToDelete = dailyTasksToDelete.map(function (dailyTask) {
				return dailyTask.dataValues.id;
			});
			convo.tasksEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;

			// spit back updated task list
			var taskArray = [];
			dailyTasks.forEach(function (dailyTask, index) {
				var id = dailyTask.dataValues.id;

				if (dailyTaskIdsToDelete.indexOf(id) < 0) {
					// daily task is NOT in the ids to delete
					taskArray.push(dailyTask);
				}
			});

			var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray);

			convo.say("Here's your updated task list :memo::");
			convo.say(taskListMessage);

			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Okay, let me know if you still want to `edit tasks`");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			convo.say("Couldn't quite catch that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

/**
 * 			~~ EDIT TIMES TO TASKS FLOW ~~
 */

function editTaskTimesFlow(response, convo) {
	convo.say("~~ EDITING TIME TO TASKS ~~");
	convo.next();
}
//# sourceMappingURL=editTaskListFunctions.js.map