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
		case _constants.constants.PLAN_DECISION.revise.word:
			console.log('\n\n ~~ user wants to revise tasks in specificCommandFlow ~~ \n\n');
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToReviseArray = (0, _messageHelpers.convertTaskNumberStringToArray)(taskNumberString, dailyTasks);
			if (taskNumbersToReviseArray) {
				// single line complete ability
				singleLineReviseTask(convo, taskNumbersToReviseArray);
			} else {
				reviseTasksFlow(convo);
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

		convo.say('You have no remaining priorities for today. Let me know when you want to `add priorities`!');
	} else {

		var workSessionMessage = '';
		if (openWorkSession && currentSession) {
			var minutes = currentSession.minutes;
			var minutesString = currentSession.minutesString;
			var sessionTasks = currentSession.sessionTasks;
			var endTimeString = currentSession.endTimeString;
			var storedWorkSession = currentSession.storedWorkSession;

			var attachments = _constants.startSessionOptionsAttachments;
			if (storedWorkSession) {
				// currently paused
				minutes = storedWorkSession.dataValues.minutes;
				minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
				workSessionMessage = 'Your session is still paused :double_vertical_bar:. ';
				attachments = _constants.pausedSessionOptionsAttachments;
			}

			workSessionMessage = workSessionMessage + ':weight_lifter: You have ' + minutesString + ' remaining in your session for `' + sessionTasks + '` :weight_lifter:';
			convo.say({
				text: workSessionMessage,
				attachments: attachments
			});
		}
	}
}

function sayTasksForToday(convo) {
	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];


	// different options for 1-2 priorities vs 3 priorities

	var _convo$planEdit4 = convo.planEdit;
	var dailyTasks = _convo$planEdit4.dailyTasks;
	var newTasks = _convo$planEdit4.newTasks;

	var remainingTasks = getRemainingTasks(dailyTasks, newTasks);

	options.segmentCompleted = true;

	var buttonsValuesArray = [];

	if (dailyTasks.length > 0 && dailyTasks.length < 3) {
		// 1-2 priorities

		buttonsValuesArray = [_constants.buttonValues.planCommands.addPriority.value, _constants.buttonValues.planCommands.deletePriority.value, _constants.buttonValues.planCommands.completePriority.value, _constants.buttonValues.planCommands.workOnPriority.value, _constants.buttonValues.planCommands.endDay.value];
	} else {
		// 3 priorities
		buttonsValuesArray = [_constants.buttonValues.planCommands.revisePriority.value, _constants.buttonValues.planCommands.deletePriority.value, _constants.buttonValues.planCommands.completePriority.value, _constants.buttonValues.planCommands.workOnPriority.value, _constants.buttonValues.planCommands.endDay.value];
	}

	var attachmentsConfig = { buttonsValuesArray: buttonsValuesArray };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);
	var attachments = (0, _messageHelpers.getPlanCommandCenterAttachments)(attachmentsConfig);

	if (options.onlyRemainingTasks) {
		var remainingPriorityString = dailyTasks.length == 1 ? 'Here is your remaining priority' : 'Here are your remaining priorities';
		convo.say(remainingPriorityString + ' for today :memo::');
	} else {
		taskListMessage = 'Here\'s today\'s plan :memo::\n' + taskListMessage;
	}

	if (options.customTaskListMessage) {
		taskListMessage = options.customTaskListMessage;
	}

	convo.say({
		text: taskListMessage,
		attachments: attachments
	});

	sayEndOfPlanMessage(convo);
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
	convo.next();
}

/**
 * 				~~ REVISE TASK ~~
 * 		this essentially deletes a task then adds one combined
 */
function singleLineReviseTask(convo, taskNumbersToReviseArray) {
	var dailyTasks = convo.planEdit.dailyTasks;

	var dailyTasksToRevise = [];
	dailyTasks.forEach(function (dailyTask, index) {
		var _dailyTask$dataValues = dailyTask.dataValues;
		var priority = _dailyTask$dataValues.priority;
		var type = _dailyTask$dataValues.type;
		var done = _dailyTask$dataValues.Task.done;
		// not already completed and is live

		if (taskNumbersToReviseArray.indexOf(priority) > -1 && !done && type == "live") {
			dailyTasksToRevise.push(dailyTask);
		}
	});

	if (dailyTasksToRevise.length > 0) {

		// add to complete array for planEdit
		var dailyTaskIdsToRevise = dailyTasksToRevise.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.planEdit.dailyTaskIdsToDelete = dailyTaskIdsToRevise;

		var dailyTaskTextsToRevise = dailyTasksToRevise.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToReviseString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTextsToRevise);

		convo.say({
			text: 'Got it -- I removed `' + dailyTasksToReviseString + '` from your plan today'
		});
		addTasksFlow(convo);
		convo.next();
	} else {
		convo.say("I couldn't find that priority to revise!");
		reviseTasksFlow(convo);
	}

	convo.next();
}

function reviseTasksFlow(convo) {
	var _convo$planEdit6 = convo.planEdit;
	var bot = _convo$planEdit6.bot;
	var dailyTasks = _convo$planEdit6.dailyTasks;
	var changePlanCommand = _convo$planEdit6.changePlanCommand;
	var changedPlanCommands = _convo$planEdit6.changedPlanCommands;

	convo.planEdit.inFlow = true;

	// say task list, then ask which ones to check off
	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	var baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = 'Okay! Which priority above do you want to';
	} else {
		baseMessage = 'Which priority above do you want to';
		sayTasksForToday(convo, options);
	}

	var wordSwapCount = 0;
	var message = wordSwapMessage(baseMessage, "revise?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_REVISE",
			fallback: "Which priority do you want to revise?",
			actions: [{
				name: _constants.buttonValues.neverMind.name,
				text: 'Never mind!',
				value: _constants.buttonValues.neverMind.value,
				type: 'button'
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			convo.say("Got it :thumbsup: If you need to revise a priority, just let me know");
			convo.planEdit.showUpdatedPlan = true;
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
			if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text) || _constants.constants.PLAN_DECISION.delete.reg_exp.test(text) || _constants.constants.PLAN_DECISION.work.reg_exp.test(text) || _constants.constants.PLAN_DECISION.revise.reg_exp.test(text)) {

				changePlanCommand.decision = true;
				changePlanCommand.text = text;
			}

			if (changePlanCommand.decision) {
				convo.stop();
				convo.next();
			} else {

				// otherwise do the expected, default decision!
				var taskNumbersToReviseArray = (0, _messageHelpers.convertTaskNumberStringToArray)(text, dailyTasks);

				if (_constants.constants.PLAN_DECISION.revise.reg_exp.test(text) && !taskNumbersToReviseArray) {

					// if user tries completing task again, just update the text
					wordSwapCount++;
					var _text = wordSwapMessage(baseMessage, "revise?", wordSwapCount);
					var convoAskQuestionUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot);
					if (convoAskQuestionUpdate) {
						convoAskQuestionUpdate.text = _text;
						bot.api.chat.update(convoAskQuestionUpdate);
					}
				} else {

					if (taskNumbersToReviseArray) {

						// say task list, then ask which ones to complete
						var _options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };

						singleLineReviseTask(convo, taskNumbersToReviseArray);
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
 * 		~~ COMPLETE TASKS ~~
 */

// complete the tasks requested
function singleLineCompleteTask(convo, taskNumbersToCompleteArray) {
	var _convo$planEdit7 = convo.planEdit;
	var dailyTasks = _convo$planEdit7.dailyTasks;
	var dailyTaskIdsToComplete = _convo$planEdit7.dailyTaskIdsToComplete;

	var dailyTasksToComplete = [];
	dailyTasks = dailyTasks.filter(function (dailyTask, index) {
		var _dailyTask$dataValues2 = dailyTask.dataValues;
		var priority = _dailyTask$dataValues2.priority;
		var type = _dailyTask$dataValues2.type;
		var done = _dailyTask$dataValues2.Task.done;

		var stillNotCompleted = true;
		// not already completed
		if (taskNumbersToCompleteArray.indexOf(priority) > -1 && !done && type == "live") {
			dailyTasksToComplete.push(dailyTask);
			stillNotCompleted = false;
		}
		return stillNotCompleted;
	});

	if (dailyTasksToComplete.length > 0) {

		// add to complete array for planEdit
		dailyTaskIdsToComplete = dailyTasksToComplete.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.planEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;

		var dailyTaskTextsToComplete = dailyTasksToComplete.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToCompleteString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTextsToComplete);

		convo.say({
			text: 'Great work :punch:. I checked off `' + dailyTasksToCompleteString + '`!'
		});

		convo.planEdit.showUpdatedPlan = true;
		convo.next();
	} else {
		convo.say("I couldn't find that priority to check off!");
		completeTasksFlow(convo);
	}

	convo.next();
}

function completeTasksFlow(convo) {
	var _convo$planEdit8 = convo.planEdit;
	var bot = _convo$planEdit8.bot;
	var dailyTasks = _convo$planEdit8.dailyTasks;
	var changePlanCommand = _convo$planEdit8.changePlanCommand;
	var changedPlanCommands = _convo$planEdit8.changedPlanCommands;

	convo.planEdit.inFlow = true;

	// say task list, then ask which ones to check off
	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	var baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = 'Okay! Which priority above did you';
	} else {
		baseMessage = 'Which priority above did you';
		sayTasksForToday(convo, options);
	}

	var wordSwapCount = 0;
	var message = wordSwapMessage(baseMessage, "complete?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_COMPLETE",
			fallback: "Which priority did you complete?",
			actions: [{
				name: _constants.buttonValues.neverMind.name,
				text: 'Never mind!',
				value: _constants.buttonValues.neverMind.value,
				type: 'button'
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			convo.say("Got it! If you need to mark a priority as completed, just let me know");
			convo.planEdit.showUpdatedPlan = true;
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
			if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text) || _constants.constants.PLAN_DECISION.delete.reg_exp.test(text) || _constants.constants.PLAN_DECISION.work.reg_exp.test(text) || _constants.constants.PLAN_DECISION.revise.reg_exp.test(text)) {

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
					var _text2 = wordSwapMessage(baseMessage, "complete?", wordSwapCount);
					var convoAskQuestionUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot);
					if (convoAskQuestionUpdate) {
						convoAskQuestionUpdate.text = _text2;
						bot.api.chat.update(convoAskQuestionUpdate);
					}
				} else {

					if (taskNumbersToCompleteArray) {

						// say task list, then ask which ones to complete
						var _options2 = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };

						singleLineCompleteTask(convo, taskNumbersToCompleteArray);
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
	var _convo$planEdit9 = convo.planEdit;
	var dailyTasks = _convo$planEdit9.dailyTasks;
	var dailyTaskIdsToDelete = _convo$planEdit9.dailyTaskIdsToDelete;

	var dailyTasksToDelete = [];
	dailyTasks = dailyTasks.filter(function (dailyTask, index) {
		var _dailyTask$dataValues3 = dailyTask.dataValues;
		var priority = _dailyTask$dataValues3.priority;
		var type = _dailyTask$dataValues3.type;
		var done = _dailyTask$dataValues3.Task.done;

		var stillNotDeleted = true;
		// not already deleted
		if (taskNumbersToDeleteArray.indexOf(priority) > -1 && type == "live" && !done) {
			dailyTasksToDelete.push(dailyTask);
			stillNotDeleted = false;
		}
		return stillNotDeleted;
	});

	if (dailyTasksToDelete.length > 0) {

		// add to delete array for planEdit
		dailyTaskIdsToDelete = dailyTasksToDelete.map(function (dailyTask) {
			return dailyTask.dataValues.id;
		});
		convo.planEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;

		var dailyTasksTextsToDelete = dailyTasksToDelete.map(function (dailyTask) {
			return dailyTask.dataValues.Task.text;
		});
		var dailyTasksToDeleteString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTasksTextsToDelete);

		convo.say({
			text: 'Sounds good, I removed `' + dailyTasksToDeleteString + '` from your plan today!'
		});
		convo.planEdit.showUpdatedPlan = true;
		convo.next();
	} else {
		convo.say("I couldn't find that priority to remove!");
		deleteTasksFlow(convo);
	}

	convo.next();
}

function deleteTasksFlow(convo) {
	var _convo$planEdit10 = convo.planEdit;
	var bot = _convo$planEdit10.bot;
	var dailyTasks = _convo$planEdit10.dailyTasks;
	var changePlanCommand = _convo$planEdit10.changePlanCommand;
	var changedPlanCommands = _convo$planEdit10.changedPlanCommands;

	convo.planEdit.inFlow = true;

	// say task list, then ask which ones to complete
	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	var baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = 'Okay! Which priority above would you like to';
	} else {
		baseMessage = 'Which priority above would you like to';
		sayTasksForToday(convo, options);
	}

	var wordSwapCount = 0;
	var message = wordSwapMessage(baseMessage, "remove?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "TASK_REMOVE",
			fallback: "Which priority would you like to remove?",
			actions: [{
				name: _constants.buttonValues.neverMind.name,
				text: 'Never mind!',
				value: _constants.buttonValues.neverMind.value,
				type: 'button'
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Got it :thumbsup: Let me know if you still want to `delete a priority`");
			convo.planEdit.showUpdatedPlan = true;
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
			if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text) || _constants.constants.PLAN_DECISION.complete.reg_exp.test(text) || _constants.constants.PLAN_DECISION.work.reg_exp.test(text) || _constants.constants.PLAN_DECISION.revise.reg_exp.test(text)) {

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
					var _text3 = wordSwapMessage(baseMessage, "remove?", wordSwapCount);
					var convoAskQuestionUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot);
					if (convoAskQuestionUpdate) {
						convoAskQuestionUpdate.text = _text3;
						bot.api.chat.update(convoAskQuestionUpdate);
					}
				} else {

					if (taskNumbersToDeleteArray) {

						singleLineDeleteTask(convo, taskNumbersToDeleteArray);
					} else {
						convo.say("Oops, I don't totally understand :dog:. Let's try this again");
						convo.say("Please pick priorities from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
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
	var _convo$planEdit11 = convo.planEdit;
	var bot = _convo$planEdit11.bot;
	var dailyTasks = _convo$planEdit11.dailyTasks;
	var newTasks = _convo$planEdit11.newTasks;
	var actuallyWantToAddATask = _convo$planEdit11.actuallyWantToAddATask;
	var changePlanCommand = _convo$planEdit11.changePlanCommand;

	// say task list, then ask for user to add tasks

	var options = { onlyRemainingTasks: true, dontCalculateMinutes: true, newTasks: newTasks };
	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks, options);

	// cannot add more than 3 priorities for the day!
	if (dailyTasks.length >= 3) {
		convo.say('You can only have 3 priorities for the day! This is to make sure you don\'t overload your todo\'s, and instead focus on getting the most important things done each day. You can revise or remove one of your priorities if they aren\'t critical anymore');
		convo.next();
	} else {
		convo.ask({
			text: 'Which new priority would you like me to add to your plan?',
			attachments: [{
				attachment_type: 'default',
				callback_id: "ADD_PRIORITY",
				fallback: "Let's add a priority to your list!",
				actions: [{
					name: _constants.buttonValues.neverMind.name,
					text: 'Never mind!',
					value: _constants.buttonValues.neverMind.value,
					type: 'button'
				}]
			}]
		}, [{ // NL equivalent to buttonValues.neverMind.value
			pattern: _botResponses.utterances.noAndNeverMind,
			callback: function callback(response, convo) {
				convo.say("Okay!");
				var options = { dontUseDataValues: true };
				sayTasksForToday(convo, options);
				convo.next();
			}
		}, { // accept the priority
			default: true,
			callback: function callback(response, convo) {
				var text = response.text;

				convo.planEdit.newPriority = {
					text: text
				};

				convo.say('Love it!');
				addTimeToPriority(response, convo);
				convo.next();
			}
		}]);
	}
}

function addTimeToPriority(response, convo) {
	var source_message = convo.source_message;
	var _convo$planEdit12 = convo.planEdit;
	var tz = _convo$planEdit12.tz;
	var bot = _convo$planEdit12.bot;
	var dailyTasks = _convo$planEdit12.dailyTasks;
	var newTasks = _convo$planEdit12.newTasks;
	var actuallyWantToAddATask = _convo$planEdit12.actuallyWantToAddATask;
	var changePlanCommand = _convo$planEdit12.changePlanCommand;
	var newPriority = _convo$planEdit12.newPriority;


	var newPriorityText = newPriority.text;

	convo.ask({
		text: 'How much time would you like to put toward `' + newPriorityText + '` today?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "TIME_TO_PRIORITY",
			fallback: "How much time to your new priority?",
			actions: [{
				name: _constants.buttonValues.planCommands.actuallyLetsRenamePriority.name,
				text: 'Wait, let\'s rename',
				value: _constants.buttonValues.planCommands.actuallyLetsRenamePriority.value,
				type: 'button'
			}]
		}]
	}, [{ // NL equivalent to buttonValues.neverMind.value
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Okay!");
			var options = { dontUseDataValues: true };
			sayTasksForToday(convo, options);
			convo.next();
		}
	}, { // let's rename the task!
		pattern: _botResponses.utterances.containsRename,
		callback: function callback(response, convo) {
			convo.say("Okay! Let's do this again :repeat_one:");
			addTasksFlow(convo);
			convo.next();
		}
	}, { // make sure this is valid time
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;
			var _response$intentObjec = response.intentObject.entities;
			var duration = _response$intentObjec.duration;
			var datetime = _response$intentObjec.datetime;

			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
			var now = (0, _moment2.default)();

			if (!customTimeObject) {
				convo.say("Sorry, I didn't get that :thinking_face:");
				convo.repeat();
			} else {

				// success and user knows time to priority!
				var durationMinutes = Math.round(_moment2.default.duration(customTimeObject.diff(now)).asMinutes());
				convo.planEdit.newPriority.minutes = durationMinutes;

				convo.say('Great! I\'ve added `' + newPriorityText + '` to your plan for today');
				convo.planEdit.showUpdatedPlan = true;
			}

			convo.next();
		}
	}]);
}

/**
 * 		~~ WORK ON TASK ~~
 */

// confirm user wants to do work session
function singleLineWorkOnTask(convo, taskNumbersToWorkOnArray) {
	var dailyTasks = convo.planEdit.dailyTasks;

	var dailyTasksToWorkOn = [];

	dailyTasksToWorkOn = dailyTasks.filter(function (dailyTask, index) {
		var _dailyTask$dataValues4 = dailyTask.dataValues;
		var priority = _dailyTask$dataValues4.priority;
		var type = _dailyTask$dataValues4.type;
		var done = _dailyTask$dataValues4.Task.done;

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
		convo.say('I couldn\'t find that priority to work on!');
		workOnTasksFlow(convo);
	}

	convo.next();
}

// work on which task flow
function workOnTasksFlow(convo) {
	var _convo$planEdit13 = convo.planEdit;
	var bot = _convo$planEdit13.bot;
	var dailyTasks = _convo$planEdit13.dailyTasks;
	var changePlanCommand = _convo$planEdit13.changePlanCommand;
	var changedPlanCommands = _convo$planEdit13.changedPlanCommands;
	var openWorkSession = _convo$planEdit13.openWorkSession;
	var currentSession = _convo$planEdit13.currentSession;

	// say task list, then ask which ones to complete

	var options = { onlyRemainingTasks: true };

	var baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = 'Okay! Which priority above would you like to';
	} else {
		baseMessage = 'Which priority above would you like to';
		sayTasksForToday(convo, options);
	}

	var wordSwap = "work towards?";
	var wordSwapCount = 0;

	if (openWorkSession && currentSession) wordSwap = "work towards instead?";

	var message = wordSwapMessage(baseMessage, wordSwap, wordSwapCount);

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "CHOOSE_FROM_PLAN",
			fallback: "Which priority would you like to work towards?"
		}]
	}, [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say("Okay, let me know if you still want to start a `new session` for one of your priorities :grin:");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			if (response.actions && response.actions[0]) {
				text = response.actions[0].value;
			}

			if (_constants.constants.PLAN_DECISION.add.reg_exp.test(text) || _constants.constants.PLAN_DECISION.complete.reg_exp.test(text) || _constants.constants.PLAN_DECISION.delete.reg_exp.test(text) || _constants.constants.PLAN_DECISION.revise.reg_exp.test(text)) {

				// CHANGE COMMANDS

				changePlanCommand.decision = true;
				changePlanCommand.text = text;
				convo.stop();
				convo.next();
			} else {

				// DO EXPECTED, DEFAULT DECISION

				var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);

				if (_constants.constants.PLAN_DECISION.work.reg_exp.test(text) && !taskNumbersToWorkOnArray) {

					// if user tries completing task again, just update the text
					wordSwapCount++;
					var _text4 = wordSwapMessage(baseMessage, wordSwap, wordSwapCount);
					var convoAskQuestionUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot);
					if (convoAskQuestionUpdate) {
						convoAskQuestionUpdate.text = _text4;
						bot.api.chat.update(convoAskQuestionUpdate);
					}
				} else {

					// ACTUAL FLOW OF CHOOSING TASK TO WORK ON

					if (taskNumbersToWorkOnArray) {

						// say task list, then ask which ones to complete
						var _options3 = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };

						singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
					} else {
						convo.say("Oops, I don't totally understand :dog:. Please pick one priority from your remaining list like `priority 2` or say `never mind`");
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
 * 		~~ DEPRECATED 8/9/16 ~~
 */

function getTimeToTasks(response, convo) {
	var _convo$planEdit14 = convo.planEdit;
	var bot = _convo$planEdit14.bot;
	var dailyTasks = _convo$planEdit14.dailyTasks;
	var newTasks = _convo$planEdit14.newTasks;
	var tz = _convo$planEdit14.tz;

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

				var _options4 = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
				taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, _options4);

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
			var _response$intentObjec2 = response.intentObject.entities;
			var reminder = _response$intentObjec2.reminder;
			var duration = _response$intentObjec2.duration;
			var datetime = _response$intentObjec2.datetime;


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
	var _convo$planEdit15 = convo.planEdit;
	var dailyTasks = _convo$planEdit15.dailyTasks;
	var newTasks = _convo$planEdit15.newTasks;


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
	var _convo$planEdit16 = convo.planEdit;
	var dailyTasks = _convo$planEdit16.dailyTasks;
	var dailyTasksToUpdate = _convo$planEdit16.dailyTasksToUpdate;
	var newTasks = _convo$planEdit16.newTasks;


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
	var _convo$planEdit17 = convo.planEdit;
	var dailyTasks = _convo$planEdit17.dailyTasks;
	var newTasks = _convo$planEdit17.newTasks;


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

	convo.next();
}

/**
 * 		~~ END OF DEPRECATED FUNCTIONS 8/9/16 ~~
 */
//# sourceMappingURL=editPlanFunctions.js.map