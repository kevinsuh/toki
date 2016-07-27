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

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// this one shows the task list message and asks for options
function startEditTaskListMessage(convo) {
	var _convo$tasksEdit = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit.dailyTasks;
	var bot = _convo$tasksEdit.bot;
	var openWorkSession = _convo$tasksEdit.openWorkSession;
	var taskNumbers = _convo$tasksEdit.taskNumbers;
	var taskDecision = _convo$tasksEdit.taskDecision;

	/**
  * 		We enter here to provide specific context if the user
  * 		has an currently open work session or not. Otherwise,
  * 		the next step is the same (`specificCommandFlow`)
  */

	if (openWorkSession) {
		openWorkSession.getStoredWorkSession({
			where: ['"StoredWorkSession"."live" = ?', true]
		}).then(function (storedWorkSession) {
			openWorkSession.getDailyTasks({
				include: [_models2.default.Task]
			}).then(function (dailyTasks) {

				var now = (0, _moment2.default)();
				var endTime = (0, _moment2.default)(openWorkSession.endTime);
				var endTimeString = endTime.format("h:mm a");
				var minutes = Math.round(_moment2.default.duration(endTime.diff(now)).asMinutes());
				var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

				var dailyTaskTexts = dailyTasks.map(function (dailyTask) {
					return dailyTask.dataValues.Task.text;
				});

				var sessionTasks = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTexts);

				convo.tasksEdit.currentSession = {
					minutes: minutes,
					minutesString: minutesString,
					sessionTasks: sessionTasks,
					endTimeString: endTimeString,
					storedWorkSession: storedWorkSession
				};

				if (storedWorkSession) {
					convo.tasksEdit.currentSession.isPaused = true;
				}

				/**
     * 		~~ Start of flow for specific command ~~
     * 				* if you have an openWorkSession *
     */

				specificCommandFlow(convo);
				convo.next();
			});
		});
	} else {

		/**
   * 		~~ Start of flow for specific command ~~
   * 		 * if you don't have openWorkSession *
   */

		specificCommandFlow(convo);
		convo.next();
	}
}

/**
 * 		ENTRY POINT FOR VIEW / EDIT PLAN
 */
function specificCommandFlow(convo) {
	var _convo$tasksEdit2 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit2.dailyTasks;
	var bot = _convo$tasksEdit2.bot;
	var openWorkSession = _convo$tasksEdit2.openWorkSession;
	var taskNumbers = _convo$tasksEdit2.taskNumbers;
	var taskDecision = _convo$tasksEdit2.taskDecision;
	var currentSession = _convo$tasksEdit2.currentSession;


	switch (taskDecision) {
		case _constants.TASK_DECISION.complete.word:
			console.log('\n\n ~~ user wants to complete tasks in specificCommandFlow ~~ \n\n');
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(taskNumberString, dailyTasks);
			if (taskNumbersToCompleteArray) {
				// single line complete ability
				singleLineCompleteTask(convo, taskNumbersToCompleteArray);
			} else {
				completeTasksFlow(convo);
			}
			break;
		case _constants.TASK_DECISION.add.word:
			console.log('\n\n ~~ user wants to add tasks in specificCommandFlow ~~ \n\n');
			addTasksFlow(convo);
			break;
		case _constants.TASK_DECISION.view.word:
			console.log('\n\n ~~ user wants to view tasks in specificCommandFlow ~~ \n\n');
			sayTasksForToday(convo);
			break;
		case _constants.TASK_DECISION.delete.word:
			console.log('\n\n ~~ user wants to delete tasks in specificCommandFlow ~~ \n\n');
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToDeleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(taskNumberString, dailyTasks);
			if (taskNumbersToDeleteArray) {
				// single line complete ability
				singleLineDeleteTask(convo, taskNumbersToDeleteArray);
			} else {
				deleteTasksFlow(convo);
			}
			break;
		case _constants.TASK_DECISION.edit.word:
			console.log('\n\n ~~ user wants to edit tasks in specificCommandFlow ~~ \n\n');
			sayTasksForToday(convo);
			convo.say("You can complete, delete, or add tasks to this list ( `complete task 2` or `add tasks`)!");
			break;
		case _constants.TASK_DECISION.work.word:

			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(taskNumberString, dailyTasks);

			if (taskNumbersToWorkOnArray) {
				// single line work ability
				singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
			} else {
				workOnTasksFlow(convo);
			}
			break;
		default:
			break;
	}

	// sayWorkSessionMessage(convo);

	// if (remainingTasks.length == 0) {
	// 	askForTaskListOptionsIfNoRemainingTasks(convo);
	// }

	convo.next();
}

// if no remaining tasks, ask to add new ones
function checkForNoRemainingTasks(convo) {
	var _convo$tasksEdit3 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit3.dailyTasks;
	var newTasks = _convo$tasksEdit3.newTasks;

	var remainingTasks = getRemainingTasks(dailyTasks, newTasks);
	if (remainingTasks.length == 0) {

		convo.say('You have no remaining tasks for today. Let me know when you want to `add tasks`!');

		if (false) {
			convo.ask('You have no remaining tasks for today. Would you like to add some tasks?', [{
				pattern: _botResponses.utterances.yes,
				callback: function callback(response, convo) {
					addTasksFlow(convo);
					convo.next();
				}
			}, {
				pattern: _botResponses.utterances.no,
				callback: function callback(response, convo) {
					convo.say("Okay! Let me know when you want to add tasks, or make a new plan :memo:");
					convo.next();
				}
			}, {
				default: true,
				callback: function callback(response, convo) {
					convo.say("Sorry, I didn't catch that");
					convo.repeat();
					convo.next();
				}
			}]);
		}
	}
}

function getRemainingTasks(fullTaskArray, newTasks) {
	var remainingTasks = [];
	fullTaskArray.forEach(function (task) {
		if (task.dataValues) {
			task = task.dataValues;
		};
		if (!task.done && task.type == 'live') {
			remainingTasks.push(task);
		}
	});

	if (newTasks) {
		newTasks.forEach(function (newTask) {
			remainingTasks.push(newTask);
		});
	}
	return remainingTasks;
}

function sayWorkSessionMessage(convo) {
	var _convo$tasksEdit4 = convo.tasksEdit;
	var openWorkSession = _convo$tasksEdit4.openWorkSession;
	var currentSession = _convo$tasksEdit4.currentSession;


	var workSessionMessage = '';
	if (openWorkSession && currentSession) {
		var minutes = currentSession.minutes;
		var minutesString = currentSession.minutesString;
		var sessionTasks = currentSession.sessionTasks;
		var endTimeString = currentSession.endTimeString;
		var storedWorkSession = currentSession.storedWorkSession;

		if (storedWorkSession) {
			// currently paused
			minutes = storedWorkSession.dataValues.minutes;
			minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
			workSessionMessage = 'Your session is still paused :double_vertical_bar: You have *' + minutesString + '* remaining for ' + sessionTasks;
		} else {
			// currently live
			workSessionMessage = 'You\'re currently in a session for ' + sessionTasks + ' until *' + endTimeString + '* (' + minutesString + ' left)';
		}
		convo.say(workSessionMessage);
	}
}

function sayTasksForToday(convo) {
	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
	var _convo$tasksEdit5 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit5.dailyTasks;
	var newTasks = _convo$tasksEdit5.newTasks;

	var remainingTasks = getRemainingTasks(dailyTasks, newTasks);

	if (dailyTasks.length > 0 && (!options.onlyRemainingTasks || options.onlyRemainingTasks && remainingTasks.length > 0)) {
		options.segmentCompleted = true;
		var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

		var taskMessage = "Here are your tasks for today :memo::";
		if (options.onlyRemainingTasks) {
			taskMessage = "Here are your remaining tasks for today :memo::";
		}
		if (!options.noTitle) {
			convo.say(taskMessage);
		}
		var attachmentOptions = {};
		if (options.scope) {
			attachmentOptions.scope = options.scope;
		}
		var attachments = (0, _miscHelpers.getPlanCommandOptionAttachments)(attachmentOptions);
		if (options.planTitle) {
			taskListMessage = 'Here\'s your plan for today :memo::\n' + taskListMessage;
		}
		convo.say({
			text: taskListMessage,
			attachments: attachments
		});
	}
}

/**
 * 		~~ COMPLETE TASKS ~~
 */

// complete the tasks requested
function singleLineCompleteTask(convo, taskNumbersToCompleteArray) {
	var _convo$tasksEdit6 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit6.dailyTasks;
	var dailyTaskIdsToComplete = _convo$tasksEdit6.dailyTaskIdsToComplete;

	var dailyTasksToComplete = [];
	dailyTasks = dailyTasks.filter(function (dailyTask, index) {
		var _dailyTask$dataValues = dailyTask.dataValues;
		var priority = _dailyTask$dataValues.priority;
		var type = _dailyTask$dataValues.type;
		var done = _dailyTask$dataValues.Task.done;

		var stillNotCompleted = true;
		// not already completed
		if (taskNumbersToCompleteArray.indexOf(priority) > -1 && !done && type == "live") {
			dailyTasksToComplete.push(dailyTask);
			stillNotCompleted = false;
		}
		return stillNotCompleted;
	});

	var priority = 1;
	dailyTasks = dailyTasks.map(function (dailyTask) {
		dailyTask.dataValues.priority = priority;
		priority++;
		return dailyTask;
	});

	convo.tasksEdit.dailyTasks = dailyTasks;

	if (dailyTasksToComplete.length > 0) {
		var dailyTaskTextsToComplete = dailyTasksToComplete.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToCompleteString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTextsToComplete);

		// add to complete array for tasksEdit
		dailyTaskIdsToComplete = dailyTasksToComplete.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.tasksEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;

		convo.say({
			text: 'Great work :punch:. I checked off ' + dailyTasksToCompleteString + '!',
			attachments: [{
				attachment_type: 'default',
				callback_id: "UNDO_BUTTON",
				fallback: "Here is your task list",
				color: _constants.colorsHash.grey.hex,
				actions: [{
					name: '' + dailyTaskIdsToComplete,
					text: "Wait, that's not right!",
					value: _constants.buttonValues.undoTaskComplete.value,
					type: "button"
				}]
			}]
		});

		var options = { onlyRemainingTasks: true };
		sayTasksForToday(convo, options);
		checkForNoRemainingTasks(convo);
	} else {
		convo.say("I couldn't find that task to complete!");
		completeTasksFlow(convo);
	}

	convo.next();
}

function completeTasksFlow(convo) {
	var _convo$tasksEdit7 = convo.tasksEdit;
	var bot = _convo$tasksEdit7.bot;
	var dailyTasks = _convo$tasksEdit7.dailyTasks;
	var changePlanCommand = _convo$tasksEdit7.changePlanCommand;
	var changedPlanCommands = _convo$tasksEdit7.changedPlanCommands;

	// say task list, then ask which ones to complete

	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, planTitle: true };
	var message = '';
	if (changedPlanCommands) {
		message = 'Okay! Which of your task(s) above would you like to complete?';
	} else {
		sayTasksForToday(convo, options);
		message = 'Which of your task(s) above would you like to complete?';
	}

	convo.ask({
		text: message
	}, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete the plan if "never mind"
			(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);

			convo.say("Okay, let me know if you still want to complete tasks! :wave: ");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			if (response.actions && response.actions[0]) {
				text = response.actions[0].value;
			}

			// if key word exists, we are stopping early and do the other flow!
			if (_constants.TASK_DECISION.add.reg_exp.test(text) || _constants.TASK_DECISION.delete.reg_exp.test(text) || _constants.TASK_DECISION.work.reg_exp.test(text)) {
				changePlanCommand.decision = true;
				changePlanCommand.text = text;
			}

			if (changePlanCommand.decision) {
				convo.stop();
				convo.next();
			} else {
				// otherwise do the expected, default decision!
				var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(text, dailyTasks);
				if (taskNumbersToCompleteArray) {
					singleLineCompleteTask(convo, taskNumbersToCompleteArray);
				} else {
					convo.say("Oops, I don't totally understand :dog:. Let's try this again");
					convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
					convo.repeat();
				}
				convo.next();
			}
		}
	}]);

	convo.next();
}

/**
 * 		~~ DELETE TASKS ~~
 */

function singleLineDeleteTask(convo, taskNumbersToDeleteArray) {
	var _convo$tasksEdit8 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit8.dailyTasks;
	var dailyTaskIdsToDelete = _convo$tasksEdit8.dailyTaskIdsToDelete;

	var dailyTasksToDelete = [];
	dailyTasks = dailyTasks.filter(function (dailyTask, index) {
		var _dailyTask$dataValues2 = dailyTask.dataValues;
		var priority = _dailyTask$dataValues2.priority;
		var type = _dailyTask$dataValues2.type;
		var done = _dailyTask$dataValues2.Task.done;

		var stillNotDeleted = true;
		// not already deleted
		if (taskNumbersToDeleteArray.indexOf(priority) > -1 && type == "live" && !done) {
			dailyTasksToDelete.push(dailyTask);
			stillNotDeleted = false;
		}
		return stillNotDeleted;
	});

	var priority = 1;
	dailyTasks = dailyTasks.map(function (dailyTask) {
		dailyTask.dataValues.priority = priority;
		priority++;
		return dailyTask;
	});

	convo.tasksEdit.dailyTasks = dailyTasks;

	if (dailyTasksToDelete.length > 0) {
		var dailyTasksTextsToDelete = dailyTasksToDelete.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToDeleteString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTasksTextsToDelete);

		// add to delete array for tasksEdit
		dailyTaskIdsToDelete = dailyTasksToDelete.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.tasksEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;

		convo.say({
			text: 'Sounds good, I deleted ' + dailyTasksToDeleteString + '!',
			attachments: [{
				attachment_type: 'default',
				callback_id: "UNDO_BUTTON",
				fallback: "Here is your task list",
				color: _constants.colorsHash.grey.hex,
				actions: [{
					name: '' + dailyTaskIdsToDelete,
					text: "Wait, that's not right!",
					value: _constants.buttonValues.undoTaskDelete.value,
					type: "button"
				}]
			}]
		});

		var options = { onlyRemainingTasks: true };
		sayTasksForToday(convo, options);
		checkForNoRemainingTasks(convo);
	} else {
		convo.say("I couldn't find that task to delete!");
		deleteTasksFlow(convo);
	}

	convo.next();
}

function deleteTasksFlow(convo) {
	var _convo$tasksEdit9 = convo.tasksEdit;
	var bot = _convo$tasksEdit9.bot;
	var dailyTasks = _convo$tasksEdit9.dailyTasks;
	var changePlanCommand = _convo$tasksEdit9.changePlanCommand;
	var changedPlanCommands = _convo$tasksEdit9.changedPlanCommands;

	// say task list, then ask which ones to complete

	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, planTitle: true };
	var message = '';
	if (changedPlanCommands) {
		message = 'Okay! Which of your task(s) above would you like to delete?';
	} else {
		sayTasksForToday(convo, options);
		message = 'Which of your task(s) above would you like to delete?';
	}

	convo.ask(message, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete the plan if "never mind"
			(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);

			convo.say("Okay, let me know if you still want to delete tasks! :wave: ");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			if (response.actions && response.actions[0]) {
				text = response.actions[0].value;
			}

			// if key word exists, we are stopping early and do the other flow!
			if (_constants.TASK_DECISION.add.reg_exp.test(text) || _constants.TASK_DECISION.complete.reg_exp.test(text) || _constants.TASK_DECISION.work.reg_exp.test(text)) {
				changePlanCommand.decision = true;
				changePlanCommand.text = text;
			}

			if (changePlanCommand.decision) {
				convo.stop();
				convo.next();
			} else {
				// otherwise do the expected, default decision!
				var taskNumbersToDeleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
				if (taskNumbersToDeleteArray) {
					singleLineDeleteTask(convo, taskNumbersToDeleteArray);
				} else {
					convo.say("Oops, I don't totally understand :dog:. Let's try this again");
					convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
					convo.repeat();
				}
				convo.next();
			}
		}
	}]);

	convo.next();
}

/**
 * 		~~ ADD TASKS ~~
 */

function addTasksFlow(convo) {
	var source_message = convo.source_message;
	var _convo$tasksEdit10 = convo.tasksEdit;
	var bot = _convo$tasksEdit10.bot;
	var dailyTasks = _convo$tasksEdit10.dailyTasks;
	var newTasks = _convo$tasksEdit10.newTasks;
	var actuallyWantToAddATask = _convo$tasksEdit10.actuallyWantToAddATask;
	var changePlanCommand = _convo$tasksEdit10.changePlanCommand;

	// say task list, then ask for user to add tasks

	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

	var tasksToAdd = [];
	convo.say("Let's do it! What other tasks do you want to work on?");
	convo.ask({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list!"
		}]
	}, [{
		pattern: _constants.buttonValues.doneAddingTasks.value,
		callback: function callback(response, convo) {
			saveNewTaskResponses(tasksToAdd, convo);
			getTimeToTasks(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.done,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Excellent!");
			saveNewTaskResponses(tasksToAdd, convo);
			getTimeToTasks(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.neverMind.value
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete the plan and this taskListMessage if "never mind"
			(0, _messageHelpers.deleteMostRecentTaskListMessage)(response.channel, bot);
			(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);

			convo.say("Okay! Let me know whenever you want to add more tasks");
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);

			var text = response.text;

			var newTask = {
				text: text,
				newTask: true
			};

			tasksToAdd.push(newTask);
			var taskArray = [];
			newTasks.forEach(function (task) {
				taskArray.push(task);
			});
			tasksToAdd.forEach(function (task) {
				taskArray.push(task);
			});

			options = { onlyRemainingTasks: true, dontCalculateMinutes: true };
			if (actuallyWantToAddATask) {
				options.dontCalculateMinutes = true;
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);
			} else {
				options.segmentCompleted = true;
				options.newTasks = taskArray;
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);
			}

			if (updateTaskListMessageObject) {
				updateTaskListMessageObject.text = taskListMessage;
				updateTaskListMessageObject.attachments = JSON.stringify(_constants.taskListMessageDoneButtonAttachment);

				bot.api.chat.update(updateTaskListMessageObject);
			}
		}
	}]);

	convo.next();
}

function getTimeToTasks(response, convo) {
	var _convo$tasksEdit11 = convo.tasksEdit;
	var bot = _convo$tasksEdit11.bot;
	var dailyTasks = _convo$tasksEdit11.dailyTasks;
	var newTasks = _convo$tasksEdit11.newTasks;
	var tz = _convo$tasksEdit11.tz;

	var options = { dontShowMinutes: true, dontCalculateMinutes: true, noKarets: true };

	var taskArray = dailyTasks;
	var taskArrayType = "update";
	if (newTasks && newTasks.length > 0) {
		taskArrayType = "new";
		taskArray = newTasks;
	}

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	var timeToTasksArray = [];

	var mainText = "Let's add time to each of your tasks:";
	var taskTextsArray = taskArray.map(function (task) {
		if (task.dataValues) {
			task = task.dataValues;
		}
		return task.text;
	});
	var attachments = (0, _messageHelpers.getTimeToTaskTextAttachmentWithTaskListMessage)(taskTextsArray, timeToTasksArray.length, taskListMessage);

	convo.ask({
		text: mainText,
		attachments: attachments
	}, [{
		pattern: _constants.buttonValues.actuallyWantToAddATask.value,
		callback: function callback(response, convo) {
			convo.tasksEdit.actuallyWantToAddATask = true;
			addTasksFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.resetTimes.value,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

				timeToTasksArray.pop();
				taskArray = (0, _miscHelpers.mapTimeToTaskArray)(taskArray, timeToTasksArray);

				var _options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, _options);

				attachments = (0, _messageHelpers.getTimeToTaskTextAttachmentWithTaskListMessage)(taskTextsArray, timeToTasksArray.length, taskListMessage);

				updateTaskListMessageObject.text = mainText;
				updateTaskListMessageObject.attachments = JSON.stringify(attachments);

				bot.api.chat.update(updateTaskListMessageObject);
			}

			convo.silentRepeat();
		}
	}, {
		pattern: _botResponses.utterances.containsResetOrUndo,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

				timeToTasksArray.pop();
				taskArray = (0, _miscHelpers.mapTimeToTaskArray)(taskArray, timeToTasksArray);

				options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

				attachments = (0, _messageHelpers.getTimeToTaskTextAttachmentWithTaskListMessage)(taskTextsArray, timeToTasksArray.length, taskListMessage);

				updateTaskListMessageObject.text = mainText;
				updateTaskListMessageObject.attachments = JSON.stringify(attachments);

				bot.api.chat.update(updateTaskListMessageObject);
			}

			convo.silentRepeat();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var _response$intentObjec = response.intentObject.entities;
			var reminder = _response$intentObjec.reminder;
			var duration = _response$intentObjec.duration;
			var datetime = _response$intentObjec.datetime;


			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);

			if (updateTaskListMessageObject) {

				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
				var commaOrNewLine = new RegExp(/[,\n]/);
				var timeToTasks = response.text.split(commaOrNewLine);

				// get user string response and convert it to time!
				if (timeToTasks.length > 1) {
					// entered via comma or \n (30 min, 45 min) and requires old method
					timeToTasks.forEach(function (time) {
						var minutes = (0, _messageHelpers.convertTimeStringToMinutes)(time);
						if (minutes > 0) timeToTasksArray.push(minutes);
					});
				} else {
					// user entered only one time (1 hr 35 min) and we can use wit intelligence
					// now that we ask one at a time, we can use wit duration
					var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
					if (customTimeObject) {
						var minutes;
						if (duration) {
							minutes = (0, _miscHelpers.witDurationToMinutes)(duration);
						} else {
							// cant currently handle datetime cuz wit sucks
							minutes = (0, _messageHelpers.convertTimeStringToMinutes)(response.text);
							// this should be done through datetime, but only duration for now
							// minutes = parseInt(moment.duration(customTimeObject.diff(now)).asMinutes());
						}
					} else {
						minutes = (0, _messageHelpers.convertTimeStringToMinutes)(response.text);
					}

					if (minutes > 0) timeToTasksArray.push(minutes);
				}

				taskArray = (0, _miscHelpers.mapTimeToTaskArray)(taskArray, timeToTasksArray);

				// update message for the user
				options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);
				attachments = (0, _messageHelpers.getTimeToTaskTextAttachmentWithTaskListMessage)(taskTextsArray, timeToTasksArray.length, taskListMessage);

				updateTaskListMessageObject.text = mainText;
				updateTaskListMessageObject.attachments = JSON.stringify(attachments);

				bot.api.chat.update(updateTaskListMessageObject);

				if (timeToTasksArray.length >= taskArray.length) {
					if (taskArrayType = "new") {
						convo.tasksEdit.newTasks = taskArray;
					} else if (taskArrayType = "update") {
						convo.tasksEdit.dailyTasksToUpdate = taskArray;
					}
					confirmTimeToTasks(convo);
					convo.next();
				}
			}
		}
	}]);
}

function saveNewTaskResponses(tasksToAdd, convo) {

	// get the newTasks!
	var _convo$tasksEdit12 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit12.dailyTasks;
	var newTasks = _convo$tasksEdit12.newTasks;


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

// used for both edit time to tasks, as well as add new tasks!!
function confirmTimeToTasks(convo) {
	var _convo$tasksEdit13 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit13.dailyTasks;
	var dailyTasksToUpdate = _convo$tasksEdit13.dailyTasksToUpdate;
	var newTasks = _convo$tasksEdit13.newTasks;


	convo.ask("Are those times right?", [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			convo.say("Excellent!");

			// you use this function for either ADDING tasks or UPDATING tasks (one or the other)
			if (newTasks.length > 0) {
				// you added new tasks and are confirming time for them
				addNewTasksToTaskList(response, convo);
			} else if (dailyTasksToUpdate.length > 0) {
				// editing time to tasks
				var options = { dontUseDataValues: true, segmentCompleted: true };
				var fullTaskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasksToUpdate, options);

				convo.say("Here's your remaining task list :memo::");
				convo.say(fullTaskListMessage);
			}

			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {

			convo.say("Let's give this another try :repeat_one:");
			convo.say("Just say time estimates, like `30, 1 hour, or 15 min` and I'll figure it out and assign times to the tasks above in order :smiley:");

			if (newTasks.length > 0) {
				getTimeToTasks(response, convo);
			} else if (dailyTasksToUpdate.length > 0) {
				editTaskTimesFlow(response, convo);
			}

			convo.next();
		}
	}]);
}

function addNewTasksToTaskList(response, convo) {
	// combine the newTasks with dailyTasks
	var _convo$tasksEdit14 = convo.tasksEdit;
	var dailyTasks = _convo$tasksEdit14.dailyTasks;
	var newTasks = _convo$tasksEdit14.newTasks;

	var options = { segmentCompleted: true };

	var taskArray = [];
	dailyTasks.forEach(function (task) {
		taskArray.push(task);
	});
	newTasks.forEach(function (newTask) {
		taskArray.push(newTask);
	});

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);

	convo.say("Here's your updated task list :memo::");
	convo.say({
		text: taskListMessage,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Here's your task list!"
		}]
	});
	convo.next();
}

/**
 * 		~~ WORK ON TASK ~~
 */

// confirm user wants to do work session
function singleLineWorkOnTask(convo, taskNumbersToWorkOnArray) {
	var dailyTasks = convo.tasksEdit.dailyTasks;

	var dailyTasksToWorkOn = [];

	dailyTasks.forEach(function (dailyTask, index) {
		var priority = dailyTask.dataValues.priority;

		if (taskNumbersToWorkOnArray.indexOf(priority) > -1) {
			dailyTasksToWorkOn.push(dailyTask);
		}
	});

	if (dailyTasksToWorkOn.length > 0) {

		var taskTextsToWorkOnArray = dailyTasksToWorkOn.map(function (dailyTask) {
			var text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
			return text;
		});

		convo.tasksEdit.dailyTasksToWorkOn = dailyTasksToWorkOn;

		var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

		convo.tasksEdit.startSession = true;
		convo.say(" ");
		convo.next();
	} else {
		convo.say('I couldn\'t find that task to work on');
		var options = { onlyRemainingTasks: true };
		sayTasksForToday(convo, options);
	}

	convo.next();
}

// work on which task flow
function workOnTasksFlow(convo) {
	var _convo$tasksEdit15 = convo.tasksEdit;
	var bot = _convo$tasksEdit15.bot;
	var dailyTasks = _convo$tasksEdit15.dailyTasks;
	var changePlanCommand = _convo$tasksEdit15.changePlanCommand;
	var changedPlanCommands = _convo$tasksEdit15.changedPlanCommands;

	// say task list, then ask which ones to complete

	var options = { onlyRemainingTasks: true, planTitle: true };
	var message = '';
	if (changedPlanCommands) {
		message = 'Okay! Which of your task(s) above would you like to work on?';
	} else {
		sayTasksForToday(convo, options);
		message = 'Which of your task(s) above would you like to work on?';
	}

	convo.ask(message, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete the plan if "never mind"
			(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);

			convo.say("Okay, let me know if you still want to work on a task :muscle: ");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			if (response.actions && response.actions[0]) {
				text = response.actions[0].value;
			}

			// if key word exists, we are stopping early and do the other flow!
			if (_constants.TASK_DECISION.add.reg_exp.test(text) || _constants.TASK_DECISION.complete.reg_exp.test(text) || _constants.TASK_DECISION.delete.reg_exp.test(text)) {
				changePlanCommand.decision = true;
				changePlanCommand.text = text;
			}

			if (changePlanCommand.decision) {
				convo.stop();
				convo.next();
			} else {
				// otherwise do the expected, default decision!
				var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
				if (taskNumbersToWorkOnArray) {
					singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
				} else {
					convo.say("Oops, I don't totally understand :dog:. Let's try this again");
					convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
					convo.repeat();
				}
				convo.next();
			}
		}
	}]);

	convo.next();
}
//# sourceMappingURL=editTaskListFunctions.js.map