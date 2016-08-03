'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startEditPlanConversation = startEditPlanConversation;

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
function startEditPlanConversation(convo) {
	var _convo$planEdit = convo.planEdit;
	var dailyTasks = _convo$planEdit.dailyTasks;
	var bot = _convo$planEdit.bot;
	var openWorkSession = _convo$planEdit.openWorkSession;
	var taskNumbers = _convo$planEdit.taskNumbers;
	var planDecision = _convo$planEdit.planDecision;

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

				convo.planEdit.currentSession = {
					minutes: minutes,
					minutesString: minutesString,
					sessionTasks: sessionTasks,
					endTimeString: endTimeString,
					storedWorkSession: storedWorkSession
				};

				if (storedWorkSession) {
					convo.planEdit.currentSession.isPaused = true;
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
	var _convo$planEdit2 = convo.planEdit;
	var dailyTasks = _convo$planEdit2.dailyTasks;
	var bot = _convo$planEdit2.bot;
	var openWorkSession = _convo$planEdit2.openWorkSession;
	var taskNumbers = _convo$planEdit2.taskNumbers;
	var planDecision = _convo$planEdit2.planDecision;
	var currentSession = _convo$planEdit2.currentSession;


	switch (planDecision) {
		case _constants.constants.PLAN_DECISION.complete.word:
			console.log('\n\n ~~ user wants to check off tasks in specificCommandFlow ~~ \n\n');
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(taskNumberString, dailyTasks);
			if (taskNumbersToCompleteArray) {
				// single line complete ability
				singleLineCompleteTask(convo, taskNumbersToCompleteArray);
			} else {
				completeTasksFlow(convo);
			}
			break;
		case _constants.constants.PLAN_DECISION.add.word:
			console.log('\n\n ~~ user wants to add tasks in specificCommandFlow ~~ \n\n');
			addTasksFlow(convo);
			break;
		case _constants.constants.PLAN_DECISION.view.word:
			console.log('\n\n ~~ user wants to view tasks in specificCommandFlow ~~ \n\n');
			viewTasksFlow(convo);
			break;
		case _constants.constants.PLAN_DECISION.delete.word:
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
		case _constants.constants.PLAN_DECISION.edit.word:
			console.log('\n\n ~~ user wants to edit tasks in specificCommandFlow ~~ \n\n');
			viewTasksFlow(convo);
			break;
		case _constants.constants.PLAN_DECISION.work.word:

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

	// sayEndOfPlanMessage(convo);

	// if (remainingTasks.length == 0) {
	// 	askForTaskListOptionsIfNoRemainingTasks(convo);
	// }

	convo.next();
}

/**
 * 			~~ editTaskListFunctions Helper Messages ~~
 */

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

function sayEndOfPlanMessage(convo) {
	var _convo$planEdit3 = convo.planEdit;
	var openWorkSession = _convo$planEdit3.openWorkSession;
	var currentSession = _convo$planEdit3.currentSession;
	var dailyTasks = _convo$planEdit3.dailyTasks;
	var newTasks = _convo$planEdit3.newTasks;


	var remainingTasks = getRemainingTasks(dailyTasks, newTasks);

	if (remainingTasks.length == 0) {

		convo.say('You have no remaining tasks for today. Let me know when you want to `add tasks`!');
	} else {

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
				// currently live (handled by checkWorkSessionForLiveTasks)
				// workSessionMessage = `You're currently in a session for ${sessionTasks} until *${endTimeString}* (${minutesString} left)`;
			}
			convo.say(workSessionMessage);
		} else {
			convo.say('Let me know if there\'s anything you want to do :muscle: `i.e. lets do task 2`');
		}
	}
}

function sayTasksForToday(convo) {
	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
	var _convo$planEdit4 = convo.planEdit;
	var dailyTasks = _convo$planEdit4.dailyTasks;
	var newTasks = _convo$planEdit4.newTasks;

	var remainingTasks = getRemainingTasks(dailyTasks, newTasks);

	if (dailyTasks.length > 0 && (!options.onlyRemainingTasks || options.onlyRemainingTasks && remainingTasks.length > 0)) {
		options.segmentCompleted = true;
		var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);
		if (options.customTaskListMessage) {
			taskListMessage = options.customTaskListMessage;
		}

		var attachmentOptions = {};
		if (options.scope) {
			attachmentOptions.scope = options.scope;
		}
		var attachments = [];

		if (options.startPlan) {
			taskListMessage = 'Here\'s your plan for today :memo::\n' + taskListMessage;
			attachments = (0, _miscHelpers.getPlanCommandOptionAttachments)(attachmentOptions);
		} else if (options.endOfPlan) {
			if (options.homeBase) {
				taskListMessage = 'Here\'s today\'s plan :memo::\n' + taskListMessage;
			} else {
				taskListMessage = 'Here\'s your plan for today :memo::\n' + taskListMessage;
			}

			// this is not working consistently enough to implement right now
			attachments = (0, _miscHelpers.getEndOfPlanCommandOptionAttachments)(attachmentOptions);
		} else {
			var taskMessage = "Here are your tasks for today :memo::";
			if (options.onlyRemainingTasks) {
				taskMessage = "Here are your remaining tasks for today :memo::";
			}
			if (!options.noTitle) {
				convo.say(taskMessage);
			}
		}

		convo.say({
			text: taskListMessage,
			attachments: attachments
		});
	}
}

function wordSwapMessage(baseMessage, word, wordSwapCount) {

	var wordSwaps = ['' + word, '*' + word + '*', '*_' + word + '_*'];
	var wordSwapChoice = wordSwaps[wordSwapCount % wordSwaps.length];
	var message = baseMessage + ' ' + wordSwapChoice;
	return message;
}

/**
 * 		~~ VIEW TASKS (HOME BASE OF PLAN) ~~
 */

function viewTasksFlow(convo) {
	var _convo$planEdit5 = convo.planEdit;
	var bot = _convo$planEdit5.bot;
	var dailyTasks = _convo$planEdit5.dailyTasks;
	var changePlanCommand = _convo$planEdit5.changePlanCommand;
	var changedPlanCommands = _convo$planEdit5.changedPlanCommands;

	// say task list, then ask which ones to complete

	var options = { noTitle: true, endOfPlan: true, homeBase: true };
	sayTasksForToday(convo, options);
	sayEndOfPlanMessage(convo);
	convo.next();
}

/**
 * 		~~ COMPLETE TASKS ~~
 */

// complete the tasks requested
function singleLineCompleteTask(convo, taskNumbersToCompleteArray) {
	var _convo$planEdit6 = convo.planEdit;
	var dailyTasks = _convo$planEdit6.dailyTasks;
	var dailyTaskIdsToComplete = _convo$planEdit6.dailyTaskIdsToComplete;

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

	convo.planEdit.dailyTasks = dailyTasks;

	if (dailyTasksToComplete.length > 0) {
		var dailyTaskTextsToComplete = dailyTasksToComplete.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToCompleteString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTextsToComplete);

		// add to complete array for planEdit
		dailyTaskIdsToComplete = dailyTasksToComplete.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.planEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;

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

		var options = { dontUseDataValues: true, onlyRemainingTasks: true };
		if (convo.planEdit.inFlow) {
			// options.endOfPlan = true;
		}
		sayTasksForToday(convo, options);
	} else {
		convo.say("I couldn't find that task to check off!");
		completeTasksFlow(convo);
	}

	convo.next();
}

function completeTasksFlow(convo) {
	var _convo$planEdit7 = convo.planEdit;
	var bot = _convo$planEdit7.bot;
	var dailyTasks = _convo$planEdit7.dailyTasks;
	var changePlanCommand = _convo$planEdit7.changePlanCommand;
	var changedPlanCommands = _convo$planEdit7.changedPlanCommands;

	convo.planEdit.inFlow = true;

	// say task list, then ask which ones to check off
	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	var baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = 'Okay! Which of your task(s) above would you like to';
	} else {
		baseMessage = 'Which of your task(s) above would you like to';
		sayTasksForToday(convo, options);
	}

	var wordSwapCount = 0;
	var message = wordSwapMessage(baseMessage, "check off?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_COMPLETE",
			fallback: "Which of your task(s) would you like to check off?"
		}]
	}, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete the plan if "never mind"
			(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);

			convo.say("Okay, let me know if you still want to check off tasks! :wave: ");
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
			if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text) || _constants.constants.PLAN_DECISION.delete.reg_exp.test(text) || _constants.constants.PLAN_DECISION.work.reg_exp.test(text)) {

				// let's delete the most recent ask message
				(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

				// handling add task flow differently -- we will delete plan for now
				if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text)) {
					(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);
				}

				changePlanCommand.decision = true;
				changePlanCommand.text = text;
			}

			if (changePlanCommand.decision) {
				convo.stop();
				convo.next();
			} else {

				// otherwise do the expected, default decision!
				var taskNumbersToCompleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(text, dailyTasks);

				if (_constants.constants.PLAN_DECISION.complete.reg_exp.test(text) && !taskNumbersToCompleteArray) {

					// if user tries completing task again, just update the text
					wordSwapCount++;
					var _text = wordSwapMessage(baseMessage, "check off?", wordSwapCount);
					var convoAskQuestionUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot);
					if (convoAskQuestionUpdate) {
						convoAskQuestionUpdate.text = _text;
						bot.api.chat.update(convoAskQuestionUpdate);
					}
				} else {

					if (taskNumbersToCompleteArray) {

						// delete the plan if you finish completing a task
						(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);

						// say task list, then ask which ones to complete
						var _options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };

						singleLineCompleteTask(convo, taskNumbersToCompleteArray);
						sayEndOfPlanMessage(convo);
					} else {
						convo.say("Oops, I don't totally understand :dog:. Let's try this again");
						convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
						convo.repeat();
					}

					convo.next();
				}
			}
		}
	}]);

	convo.next();
}

/**
 * 		~~ DELETE TASKS ~~
 */

function singleLineDeleteTask(convo, taskNumbersToDeleteArray) {
	var _convo$planEdit8 = convo.planEdit;
	var dailyTasks = _convo$planEdit8.dailyTasks;
	var dailyTaskIdsToDelete = _convo$planEdit8.dailyTaskIdsToDelete;

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

	convo.planEdit.dailyTasks = dailyTasks;

	if (dailyTasksToDelete.length > 0) {
		var dailyTasksTextsToDelete = dailyTasksToDelete.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToDeleteString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTasksTextsToDelete);

		// add to delete array for planEdit
		dailyTaskIdsToDelete = dailyTasksToDelete.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.planEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;

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

		var options = { dontUseDataValues: true, onlyRemainingTasks: true };
		if (convo.planEdit.inFlow) {
			// options.endOfPlan = true;
		}
		sayTasksForToday(convo, options);
	} else {
		convo.say("I couldn't find that task to delete!");
		deleteTasksFlow(convo);
	}

	convo.next();
}

function deleteTasksFlow(convo) {
	var _convo$planEdit9 = convo.planEdit;
	var bot = _convo$planEdit9.bot;
	var dailyTasks = _convo$planEdit9.dailyTasks;
	var changePlanCommand = _convo$planEdit9.changePlanCommand;
	var changedPlanCommands = _convo$planEdit9.changedPlanCommands;

	convo.planEdit.inFlow = true;

	// say task list, then ask which ones to complete
	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	var baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = 'Okay! Which of your task(s) above would you like to';
	} else {
		baseMessage = 'Which of your task(s) above would you like to';
		sayTasksForToday(convo, options);
	}

	var wordSwapCount = 0;
	var message = wordSwapMessage(baseMessage, "delete?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_DELETE",
			fallback: "Which of your task(s) would you like to delete?"
		}]
	}, [{
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
			if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text) || _constants.constants.PLAN_DECISION.complete.reg_exp.test(text) || _constants.constants.PLAN_DECISION.work.reg_exp.test(text)) {

				// let's delete the most recent ask message
				(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

				// handling add task flow differently -- we will delete plan for now
				if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text)) {
					(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);
				}

				changePlanCommand.decision = true;
				changePlanCommand.text = text;
			}

			if (changePlanCommand.decision) {
				convo.stop();
				convo.next();
			} else {

				// otherwise do the expected, default decision!
				var taskNumbersToDeleteArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);

				if (_constants.constants.PLAN_DECISION.delete.reg_exp.test(text) && !taskNumbersToDeleteArray) {

					// if user tries completing task again, just update the text
					wordSwapCount++;
					var _text2 = wordSwapMessage(baseMessage, "delete?", wordSwapCount);
					var convoAskQuestionUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot);
					if (convoAskQuestionUpdate) {
						convoAskQuestionUpdate.text = _text2;
						bot.api.chat.update(convoAskQuestionUpdate);
					}
				} else {

					if (taskNumbersToDeleteArray) {

						// delete the plan if you finish completing a task
						(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);

						singleLineDeleteTask(convo, taskNumbersToDeleteArray);
						sayEndOfPlanMessage(convo);
					} else {
						convo.say("Oops, I don't totally understand :dog:. Let's try this again");
						convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
						convo.repeat();
					}
					convo.next();
				}
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
	var _convo$planEdit10 = convo.planEdit;
	var bot = _convo$planEdit10.bot;
	var dailyTasks = _convo$planEdit10.dailyTasks;
	var newTasks = _convo$planEdit10.newTasks;
	var actuallyWantToAddATask = _convo$planEdit10.actuallyWantToAddATask;
	var changePlanCommand = _convo$planEdit10.changePlanCommand;

	// say task list, then ask for user to add tasks

	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, newTasks: newTasks };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

	var tasksToAdd = [];

	convo.say("What other tasks do you want to work on?");
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
			options.segmentCompleted = true;
			options.newTasks = taskArray;
			taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

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
	var _convo$planEdit11 = convo.planEdit;
	var bot = _convo$planEdit11.bot;
	var dailyTasks = _convo$planEdit11.dailyTasks;
	var newTasks = _convo$planEdit11.newTasks;
	var tz = _convo$planEdit11.tz;

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
			convo.planEdit.actuallyWantToAddATask = true;
			addTasksFlow(convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.resetTimes.value,
		callback: function callback(response, convo) {

			var updateTaskListMessageObject = (0, _messageHelpers.getMostRecentTaskListMessageToUpdate)(response.channel, bot);
			if (updateTaskListMessageObject) {
				convo.planEdit.updateTaskListMessageObject = updateTaskListMessageObject;

				timeToTasksArray.pop();
				taskArray = (0, _miscHelpers.mapTimeToTaskArray)(taskArray, timeToTasksArray);

				var _options2 = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, _options2);

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
				convo.planEdit.updateTaskListMessageObject = updateTaskListMessageObject;

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

				convo.planEdit.updateTaskListMessageObject = updateTaskListMessageObject;
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
						convo.planEdit.newTasks = taskArray;
					} else if (taskArrayType = "update") {
						convo.planEdit.dailyTasksToUpdate = taskArray;
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
	var _convo$planEdit12 = convo.planEdit;
	var dailyTasks = _convo$planEdit12.dailyTasks;
	var newTasks = _convo$planEdit12.newTasks;


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

		convo.planEdit.dailyTasks = dailyTasks; // all daily tasks
		convo.planEdit.newTasks = newTasks; // only the new ones
	}

	convo.next();
}

// used for both edit time to tasks, as well as add new tasks!!
function confirmTimeToTasks(convo) {
	var _convo$planEdit13 = convo.planEdit;
	var dailyTasks = _convo$planEdit13.dailyTasks;
	var dailyTasksToUpdate = _convo$planEdit13.dailyTasksToUpdate;
	var newTasks = _convo$planEdit13.newTasks;


	convo.ask("Are those times right?", [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			convo.say("Excellent!");

			// you use this function for either ADDING tasks or UPDATING tasks (one or the other)
			if (newTasks.length > 0) {
				// you added new tasks and are confirming time for them
				addNewTasksToTaskList(response, convo);
			} else if (dailyTasksToUpdate.length > 0) {

				// say task list, then ask which ones to complete
				var options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };
				sayTasksForToday(convo, options);
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
	var _convo$planEdit14 = convo.planEdit;
	var dailyTasks = _convo$planEdit14.dailyTasks;
	var newTasks = _convo$planEdit14.newTasks;


	var taskArray = [];
	dailyTasks.forEach(function (task) {
		taskArray.push(task);
	});
	newTasks.forEach(function (newTask) {
		taskArray.push(newTask);
	});

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, { onlyRemainingTasks: true });

	// say task list, then ask which ones to complete
	var options = { dontUseDataValues: true, onlyRemainingTasks: true, customTaskListMessage: taskListMessage };
	sayTasksForToday(convo, options);

	sayEndOfPlanMessage(convo);

	convo.next();
}

/**
 * 		~~ WORK ON TASK ~~
 */

// confirm user wants to do work session
function singleLineWorkOnTask(convo, taskNumbersToWorkOnArray) {
	var dailyTasks = convo.planEdit.dailyTasks;

	var dailyTasksToWorkOn = [];

	dailyTasksToWorkOn = dailyTasks.filter(function (dailyTask, index) {
		var _dailyTask$dataValues3 = dailyTask.dataValues;
		var priority = _dailyTask$dataValues3.priority;
		var type = _dailyTask$dataValues3.type;
		var done = _dailyTask$dataValues3.Task.done;

		var workOnTask = false;
		if (taskNumbersToWorkOnArray.indexOf(priority) > -1 && type == "live" && !done) {
			workOnTask = true;
		}
		return workOnTask;
	});

	if (dailyTasksToWorkOn.length > 0) {

		var taskTextsToWorkOnArray = dailyTasksToWorkOn.map(function (dailyTask) {
			var text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
			return text;
		});

		convo.planEdit.dailyTasksToWorkOn = dailyTasksToWorkOn;

		var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

		convo.planEdit.startSession = true;
		convo.say(" ");
		convo.next();
	} else {
		convo.say('I couldn\'t find that task to work on!');
		workOnTasksFlow(convo);
	}

	convo.next();
}

// work on which task flow
function workOnTasksFlow(convo) {
	var _convo$planEdit15 = convo.planEdit;
	var bot = _convo$planEdit15.bot;
	var dailyTasks = _convo$planEdit15.dailyTasks;
	var changePlanCommand = _convo$planEdit15.changePlanCommand;
	var changedPlanCommands = _convo$planEdit15.changedPlanCommands;

	// say task list, then ask which ones to complete

	var options = { onlyRemainingTasks: true, startPlan: true };

	var baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = 'Okay! Which of your task(s) above would you like to';
	} else {
		baseMessage = 'Which of your task(s) above would you like to';
		sayTasksForToday(convo, options);
	}

	var wordSwapCount = 0;
	var message = wordSwapMessage(baseMessage, "work on?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_WORK",
			fallback: "Which of your task(s) would you like to work on?"
		}]
	}, [{
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
			if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text) || _constants.constants.PLAN_DECISION.complete.reg_exp.test(text) || _constants.constants.PLAN_DECISION.delete.reg_exp.test(text)) {

				// let's delete the most recent ask message
				(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

				// handling add task flow differently -- we will delete plan for now
				if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text)) {
					(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);
				}

				changePlanCommand.decision = true;
				changePlanCommand.text = text;
			}

			if (changePlanCommand.decision) {
				convo.stop();
				convo.next();
			} else {

				// otherwise do the expected, default decision!
				var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);

				if (_constants.constants.PLAN_DECISION.work.reg_exp.test(text) && !taskNumbersToWorkOnArray) {

					// if user tries completing task again, just update the text
					wordSwapCount++;
					var _text3 = wordSwapMessage(baseMessage, "work on?", wordSwapCount);
					var convoAskQuestionUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot);
					if (convoAskQuestionUpdate) {
						convoAskQuestionUpdate.text = _text3;
						bot.api.chat.update(convoAskQuestionUpdate);
					}
				} else {

					if (taskNumbersToWorkOnArray) {

						// delete the plan if you finish completing a task
						(0, _messageHelpers.deleteMostRecentPlanMessage)(response.channel, bot);

						// say task list, then ask which ones to complete
						var _options3 = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };

						singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
						// sayTasksForToday(convo, options);
						// sayEndOfPlanMessage(convo);
					} else {
						convo.say("Oops, I don't totally understand :dog:. Let's try this again");
						convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
						convo.repeat();
					}
					convo.next();
				}
			}
		}
	}]);

	convo.next();
}
//# sourceMappingURL=editPlanFunctions.js.map