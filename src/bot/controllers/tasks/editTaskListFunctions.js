import os from 'os';
import { wit } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues, FINISH_WORD, RESET, taskListMessageDoneButtonAttachment, taskListMessageAddMoreTasksAndResetTimesButtonAttachment, taskListMessageAddMoreTasksButtonAttachment, pausedSessionOptionsAttachments, startSessionOptionsAttachments, TASK_DECISION } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertResponseObjectsToTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, getMostRecentTaskListMessageToUpdate, getMostRecentMessageToUpdate, deleteConvoAskMessage, convertMinutesToHoursString, getTimeToTaskTextAttachmentWithTaskListMessage, deleteMostRecentTaskListMessage, deleteMostRecentPlanMessage } from '../../lib/messageHelpers';

import { consoleLog, witTimeResponseToTimeZoneObject, witDurationToMinutes, mapTimeToTaskArray, getPlanCommandOptionAttachments, getEndOfPlanCommandOptionAttachments } from '../../lib/miscHelpers';

// this one shows the task list message and asks for options
export function startEditTaskListMessage(convo) {

	const { tasksEdit: { dailyTasks, bot, openWorkSession, taskNumbers, taskDecision } } = convo;

	/**
	 * 		We enter here to provide specific context if the user
	 * 		has an currently open work session or not. Otherwise,
	 * 		the next step is the same (`specificCommandFlow`)
	 */
	
	if (openWorkSession) {
		openWorkSession.getStoredWorkSession({
			where: [ `"StoredWorkSession"."live" = ?`, true ]
		})
		.then((storedWorkSession) => {
			openWorkSession.getDailyTasks({
				include: [ models.Task ]
			})
			.then((dailyTasks) => {

				var now           = moment();
				var endTime       = moment(openWorkSession.endTime);
				var endTimeString = endTime.format("h:mm a");
				var minutes       = Math.round(moment.duration(endTime.diff(now)).asMinutes());
				var minutesString = convertMinutesToHoursString(minutes);

				var dailyTaskTexts = dailyTasks.map((dailyTask) => {
					return dailyTask.dataValues.Task.text;
				})

				var sessionTasks = commaSeparateOutTaskArray(dailyTaskTexts);

				convo.tasksEdit.currentSession = {
					minutes,
					minutesString,
					sessionTasks,
					endTimeString,
					storedWorkSession
				}

				if (storedWorkSession) {
					convo.tasksEdit.currentSession.isPaused = true;
				}

				/**
				 * 		~~ Start of flow for specific command ~~
				 * 				* if you have an openWorkSession *
				 */
				
				specificCommandFlow(convo);
				convo.next();

			})
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

	const { tasksEdit: { dailyTasks, bot, openWorkSession, taskNumbers, taskDecision, currentSession } } = convo;

	switch (taskDecision) {
		case TASK_DECISION.complete.word:
			console.log(`\n\n ~~ user wants to complete tasks in specificCommandFlow ~~ \n\n`);
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToCompleteArray = convertTaskNumberStringToArray(taskNumberString, dailyTasks);
			if (taskNumbersToCompleteArray) {
				// single line complete ability
				singleLineCompleteTask(convo, taskNumbersToCompleteArray);
			} else {
				completeTasksFlow(convo);
			}
			break;
		case TASK_DECISION.add.word:
			console.log(`\n\n ~~ user wants to add tasks in specificCommandFlow ~~ \n\n`)
			addTasksFlow(convo);
			break;
		case TASK_DECISION.view.word:
			console.log(`\n\n ~~ user wants to view tasks in specificCommandFlow ~~ \n\n`);
			convo.say("NEED TO CREATE VIEW PLAN FLOW");
			// viewTasksFlow(convo);
			break;
		case TASK_DECISION.delete.word:
			console.log(`\n\n ~~ user wants to delete tasks in specificCommandFlow ~~ \n\n`)
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToDeleteArray = convertTaskNumberStringToArray(taskNumberString, dailyTasks);
			if (taskNumbersToDeleteArray) {
				// single line complete ability
				singleLineDeleteTask(convo, taskNumbersToDeleteArray);
			} else {
				deleteTasksFlow(convo);
			}
			break;
		case TASK_DECISION.edit.word:
			console.log(`\n\n ~~ user wants to edit tasks in specificCommandFlow ~~ \n\n`)
			convo.say("NEED TO CREATE VIEW PLAN FLOW");
			// viewTasksFlow(convo);
			break;
		case TASK_DECISION.work.word:

			var taskNumberString         = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToWorkOnArray = convertTaskNumberStringToArray(taskNumberString, dailyTasks);

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

/**
 * 			~~ editTaskListFunctions Helper Messages ~~
 */

// if no remaining tasks, ask to add new ones
function checkForNoRemainingTasks(convo) {
	const { tasksEdit: { dailyTasks, newTasks } } = convo;
	let remainingTasks = getRemainingTasks(dailyTasks, newTasks);
	if (remainingTasks.length == 0) {

		convo.say(`You have no remaining tasks for today. Let me know when you want to \`add tasks\`!`);

		if (false) {
			convo.ask(`You have no remaining tasks for today. Would you like to add some tasks?`, [
				{
					pattern: utterances.yes,
					callback: (response, convo) => {
						addTasksFlow(convo);
						convo.next();
					}
				},
				{
					pattern: utterances.no,
					callback: (response, convo) => {
						convo.say("Okay! Let me know when you want to add tasks, or make a new plan :memo:");
						convo.next();
					}
				},
				{
					default: true,
					callback: (response, convo) => {
						convo.say("Sorry, I didn't catch that");
						convo.repeat();
						convo.next();
					}
				}
			]);
		}

	}
}

function getRemainingTasks(fullTaskArray, newTasks) {
	var remainingTasks = [];
	fullTaskArray.forEach((task) => {
		if (task.dataValues) {
			task = task.dataValues;
		};
		if (!task.done && task.type == 'live') {
			remainingTasks.push(task);
		}
	});

	if (newTasks) {
		newTasks.forEach((newTask) => {
			remainingTasks.push(newTask);
		})
	}
	return remainingTasks;
}


function sayWorkSessionMessage(convo) {

	let { tasksEdit: { openWorkSession, currentSession } } = convo;

	let workSessionMessage = '';
	if (openWorkSession && currentSession) {
		let { minutes, minutesString, sessionTasks, endTimeString, storedWorkSession } = currentSession;
		if (storedWorkSession) {
			// currently paused
			minutes       = storedWorkSession.dataValues.minutes;
			minutesString = convertMinutesToHoursString(minutes);
			workSessionMessage = `Your session is still paused :double_vertical_bar: You have *${minutesString}* remaining for ${sessionTasks}`;
		} else {
			// currently live
			workSessionMessage = `You're currently in a session for ${sessionTasks} until *${endTimeString}* (${minutesString} left)`;
		}
		convo.say(workSessionMessage);
	} else {
		convo.say(`Let me know when you're ready to `start a session` :muscle:`);
	}

}

function sayTasksForToday(convo, options = {}) {

	const { tasksEdit: { dailyTasks, newTasks } } = convo;
	let remainingTasks = getRemainingTasks(dailyTasks, newTasks);

	if (dailyTasks.length > 0 && (!options.onlyRemainingTasks || (options.onlyRemainingTasks && remainingTasks.length > 0))) {
		options.segmentCompleted = true;
		let taskListMessage = convertArrayToTaskListMessage(dailyTasks, options);
		if (options.customTaskListMessage) {
			taskListMessage = options.customTaskListMessage;
		}

		// let taskMessage = "Here are your tasks for today :memo::"
		// if (options.onlyRemainingTasks) {
		// 	taskMessage = "Here are your remaining tasks for today :memo::";
		// }
		// if (!options.noTitle) {
		// 	convo.say(taskMessage);
		// }
		
		let attachmentOptions = {};
		if (options.scope){
			attachmentOptions.scope = options.scope;
		}
		let attachments = [];

		if (options.startPlan) {
			taskListMessage = `Here's your plan for today :memo::\n${taskListMessage}`;
			attachments     = getPlanCommandOptionAttachments(attachmentOptions);
		} else if (options.endOfPlan) {
			taskListMessage = `Here's your plan for today :memo::\n${taskListMessage}`;
			// this is not working consistently enough to implement right now
			attachments     = getEndOfPlanCommandOptionAttachments(attachmentOptions);
		}

		convo.say({
			text: taskListMessage,
			attachments
		});
	}

}

function wordSwapMessage(baseMessage, word, wordSwapCount) {

	let wordSwaps = [`${word}`,`*${word}*`,`*_${word}_*`];
	let wordSwapChoice = wordSwaps[wordSwapCount % wordSwaps.length];
	let message = `${baseMessage} ${wordSwapChoice}`;
	return message;

}

/**
 * 		~~ COMPLETE TASKS ~~
 */

// complete the tasks requested
function singleLineCompleteTask(convo, taskNumbersToCompleteArray) {

	let { dailyTasks, dailyTaskIdsToComplete } = convo.tasksEdit;
	let dailyTasksToComplete = [];
	dailyTasks = dailyTasks.filter((dailyTask, index) => {
		const { dataValues: { priority, type, Task: { done } } } = dailyTask;
		let stillNotCompleted = true;
		// not already completed
		if (taskNumbersToCompleteArray.indexOf(priority) > -1 && !done && type == "live") {
			dailyTasksToComplete.push(dailyTask);
			stillNotCompleted = false;
		}
		return stillNotCompleted;
	});

	let priority = 1;
	dailyTasks = dailyTasks.map((dailyTask) => {
		dailyTask.dataValues.priority = priority;
		priority++;
		return dailyTask;
	});

	convo.tasksEdit.dailyTasks = dailyTasks;

	if (dailyTasksToComplete.length > 0) {
		let dailyTaskTextsToComplete = dailyTasksToComplete.map((dailyTask) => {
			return dailyTask.dataValues.Task.text;
		});
		let dailyTasksToCompleteString = commaSeparateOutTaskArray(dailyTaskTextsToComplete);

		// add to complete array for tasksEdit
		dailyTaskIdsToComplete = dailyTasksToComplete.map((dailyTask) => {
			return dailyTask.dataValues.id;
		});
		convo.tasksEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;

		convo.say({
			text: `Great work :punch:. I checked off ${dailyTasksToCompleteString}!`,
			attachments: [ {
				attachment_type: 'default',
				callback_id: "UNDO_BUTTON",
				fallback: "Here is your task list",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: `${dailyTaskIdsToComplete}`,
							text: "Wait, that's not right!",
							value: buttonValues.undoTaskComplete.value,
							type: "button"
					}
				]
			}]
		});

		// say task list, then ask which ones to complete
		let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };
		// sayTasksForToday(convo, options);
		checkForNoRemainingTasks(convo);
		sayWorkSessionMessage(convo);

	} else {
		convo.say("I couldn't find that task to complete!");
		completeTasksFlow(convo);
	}

	convo.next();

}

function completeTasksFlow(convo) {

	let { tasksEdit: { bot, dailyTasks, changePlanCommand, changedPlanCommands } } = convo;

	// say task list, then ask which ones to complete
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	let baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = `Okay! Which of your task(s) above would you like to`;
	} else {
		baseMessage = `Which of your task(s) above would you like to`;
		sayTasksForToday(convo, options);
	}

	let wordSwapCount = 0;
	let message       = wordSwapMessage(baseMessage, "complete?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [ {
			attachment_type: 'default',
			callback_id: "TASK_COMPLETE",
			fallback: "Which of your task(s) would you like to complete?"
		}]
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {

				// delete the plan if "never mind"
				deleteMostRecentPlanMessage(response.channel, bot);

				convo.say("Okay, let me know if you still want to complete tasks! :wave: ");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { text } = response;
				if (response.actions && response.actions[0]) {
					text = response.actions[0].value;
				}

				// if key word exists, we are stopping early and do the other flow!
				if (TASK_DECISION.add.reg_exp.test(text) || TASK_DECISION.delete.reg_exp.test(text) || TASK_DECISION.work.reg_exp.test(text)) {

					// let's delete the most recent ask message
					deleteConvoAskMessage(response.channel, bot);

					// handling add task flow differently -- we will delete plan for now
					if (TASK_DECISION.add.reg_exp.test(text)) {
						deleteMostRecentPlanMessage(response.channel, bot);
					}

					changePlanCommand.decision = true;
					changePlanCommand.text     = text

				}

				if (changePlanCommand.decision) {
					convo.stop();
					convo.next();
				} else  {

					if (TASK_DECISION.complete.reg_exp.test(text)) {

						// if user tries completing task again, just update the text
						wordSwapCount++;
						let text = wordSwapMessage(baseMessage, "complete?", wordSwapCount);
						let convoAskQuestionUpdate = getMostRecentMessageToUpdate(response.channel, bot);
						if (convoAskQuestionUpdate) {
							convoAskQuestionUpdate.text = text;
							bot.api.chat.update(convoAskQuestionUpdate);
						}

					} else {

						// otherwise do the expected, default decision!
						let taskNumbersToCompleteArray = convertTaskNumberStringToArray(text, dailyTasks);
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

			}
		}
	]);

	convo.next();

}


/**
 * 		~~ DELETE TASKS ~~
 */

function singleLineDeleteTask(convo, taskNumbersToDeleteArray) {

	let { dailyTasks, dailyTaskIdsToDelete } = convo.tasksEdit;
	let dailyTasksToDelete = [];
	dailyTasks = dailyTasks.filter((dailyTask, index) => {
		const { dataValues: { priority, type, Task: { done } } } = dailyTask;
		let stillNotDeleted = true;
		// not already deleted
		if (taskNumbersToDeleteArray.indexOf(priority) > -1 && type == "live" && !done) {
			dailyTasksToDelete.push(dailyTask);
			stillNotDeleted = false;
		}
		return stillNotDeleted;
	});

	let priority = 1;
	dailyTasks = dailyTasks.map((dailyTask) => {
		dailyTask.dataValues.priority = priority;
		priority++;
		return dailyTask;
	});

	convo.tasksEdit.dailyTasks = dailyTasks;

	if (dailyTasksToDelete.length > 0) {
		let dailyTasksTextsToDelete = dailyTasksToDelete.map((dailyTask) => {
			return dailyTask.dataValues.Task.text;
		});
		let dailyTasksToDeleteString = commaSeparateOutTaskArray(dailyTasksTextsToDelete);

		// add to delete array for tasksEdit
		dailyTaskIdsToDelete = dailyTasksToDelete.map((dailyTask) => {
			return dailyTask.dataValues.id;
		});
		convo.tasksEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;

		convo.say({
			text: `Sounds good, I deleted ${dailyTasksToDeleteString}!`,
			attachments: [ {
				attachment_type: 'default',
				callback_id: "UNDO_BUTTON",
				fallback: "Here is your task list",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: `${dailyTaskIdsToDelete}`,
							text: "Wait, that's not right!",
							value: buttonValues.undoTaskDelete.value,
							type: "button"
					}
				]
			}]
		});

		// say task list, then ask which ones to complete
		let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };
		// sayTasksForToday(convo, options);
		checkForNoRemainingTasks(convo);
		sayWorkSessionMessage(convo);

	} else {
		convo.say("I couldn't find that task to delete!");
		deleteTasksFlow(convo);
	}

	convo.next();

}

function deleteTasksFlow(convo) {

	let { tasksEdit: { bot, dailyTasks, changePlanCommand, changedPlanCommands } } = convo;

	// say task list, then ask which ones to complete
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	let baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = `Okay! Which of your task(s) above would you like to`;
	} else {
		baseMessage = `Which of your task(s) above would you like to`;
		sayTasksForToday(convo, options);
	}

	let wordSwapCount = 0;
	let message       = wordSwapMessage(baseMessage, "delete?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [ {
			attachment_type: 'default',
			callback_id: "TASK_DELETE",
			fallback: "Which of your task(s) would you like to delete?"
		}]
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {

				// delete the plan if "never mind"
				deleteMostRecentPlanMessage(response.channel, bot);

				convo.say("Okay, let me know if you still want to delete tasks! :wave: ");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { text } = response;
				if (response.actions && response.actions[0]) {
					text = response.actions[0].value;
				}

				// if key word exists, we are stopping early and do the other flow!
				if (TASK_DECISION.add.reg_exp.test(text) || TASK_DECISION.complete.reg_exp.test(text) || TASK_DECISION.work.reg_exp.test(text)) {

					// let's delete the most recent ask message
					deleteConvoAskMessage(response.channel, bot);

					// handling add task flow differently -- we will delete plan for now
					if (TASK_DECISION.add.reg_exp.test(text)) {
						deleteMostRecentPlanMessage(response.channel, bot);
					}

					changePlanCommand.decision = true;
					changePlanCommand.text     = text
				}

				if (changePlanCommand.decision) {
					convo.stop();
					convo.next();
				} else {

					if (TASK_DECISION.delete.reg_exp.test(text)) {

						// if user tries completing task again, just update the text
						wordSwapCount++;
						let text = wordSwapMessage(baseMessage, "delete?", wordSwapCount);
						let convoAskQuestionUpdate = getMostRecentMessageToUpdate(response.channel, bot);
						if (convoAskQuestionUpdate) {
							convoAskQuestionUpdate.text = text;
							bot.api.chat.update(convoAskQuestionUpdate);
						}

					} else {

						// otherwise do the expected, default decision!
						let taskNumbersToDeleteArray = convertTaskNumberStringToArray(response.text, dailyTasks);
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

			}
		}
	]);

	convo.next();
	
}

/**
 * 		~~ ADD TASKS ~~
 */

function addTasksFlow(convo) {

	var { source_message, tasksEdit: { bot, dailyTasks, newTasks, actuallyWantToAddATask, changePlanCommand } } = convo;

	// say task list, then ask for user to add tasks
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, newTasks };
	let taskListMessage = convertArrayToTaskListMessage(dailyTasks, options);

	var tasksToAdd = [];

	convo.say("What other tasks do you want to work on?");
	convo.ask({
		text: taskListMessage,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "TASK_LIST_MESSAGE",
				fallback: "Here's your task list!"
			}
		]
	},
	[
		{
			pattern: buttonValues.doneAddingTasks.value,
			callback: function(response, convo) {
				saveNewTaskResponses(tasksToAdd, convo);
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.done,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);
				
				convo.say("Excellent!");
				saveNewTaskResponses(tasksToAdd, convo);
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.neverMind.value
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {

				// delete the plan and this taskListMessage if "never mind"
				deleteMostRecentTaskListMessage(response.channel, bot);
				deleteMostRecentPlanMessage(response.channel, bot);

				convo.say("Okay! Let me know whenever you want to add more tasks");
				convo.next();
			}
		},
		{ // this is failure point. restart with question
			default: true,
			callback: function(response, convo) {

				let updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				const { text } = response;
				const newTask = {
					text,
					newTask: true
				}

				tasksToAdd.push(newTask);
				var taskArray = [];
				newTasks.forEach((task) => {
					taskArray.push(task);
				})
				tasksToAdd.forEach((task) => {
					taskArray.push(task);
				})

				options = { onlyRemainingTasks: true, dontCalculateMinutes: true };
				options.segmentCompleted = true;
				options.newTasks = taskArray;
				taskListMessage = convertArrayToTaskListMessage(dailyTasks, options)

				if (updateTaskListMessageObject) {
					updateTaskListMessageObject.text        = taskListMessage;
					updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageDoneButtonAttachment);

					bot.api.chat.update(updateTaskListMessageObject);
				}

			}
		}
	]);

	convo.next();

}

function getTimeToTasks(response, convo) {

	var { bot, dailyTasks, newTasks, tz } = convo.tasksEdit;
	var options                           = { dontShowMinutes: true, dontCalculateMinutes: true, noKarets: true };

	let taskArray = dailyTasks;
	let taskArrayType = "update";
	if (newTasks && newTasks.length > 0){
		taskArrayType = "new";
		taskArray     = newTasks;
	}

	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	var timeToTasksArray = [];

	var mainText = "Let's add time to each of your tasks:";
	let taskTextsArray = taskArray.map((task) => {
		if (task.dataValues) {
			task = task.dataValues;
		}
		return task.text;
	})
	let attachments = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

	convo.ask({
		text: mainText,
		attachments
	},
	[
		{
			pattern: buttonValues.actuallyWantToAddATask.value,
			callback: function(response, convo) {
				convo.tasksEdit.actuallyWantToAddATask = true;
				addTasksFlow(convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.resetTimes.value,
			callback: (response, convo) => {

				let updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);
				if (updateTaskListMessageObject) {
					convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

					timeToTasksArray.pop();
					taskArray = mapTimeToTaskArray(taskArray, timeToTasksArray);

					let options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);

					attachments     = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

					updateTaskListMessageObject.text        = mainText;
					updateTaskListMessageObject.attachments = JSON.stringify(attachments);

					bot.api.chat.update(updateTaskListMessageObject);

				}

				convo.silentRepeat();
			}
		},
		{
			pattern: utterances.containsResetOrUndo,
			callback: (response, convo) => {

				let updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);
				if (updateTaskListMessageObject) {
					convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

					timeToTasksArray.pop();
					taskArray = mapTimeToTaskArray(taskArray, timeToTasksArray);

					options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);

					attachments     = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

					updateTaskListMessageObject.text        = mainText;
					updateTaskListMessageObject.attachments = JSON.stringify(attachments);

					bot.api.chat.update(updateTaskListMessageObject);

				}

				convo.silentRepeat();

			}
		},
		{
			default: true,
			callback: function(response, convo) {

				const { intentObject: { entities: { reminder, duration, datetime } } } = response;

				let updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				if (updateTaskListMessageObject) {

					convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
					const commaOrNewLine = new RegExp(/[,\n]/);
					let timeToTasks      = response.text.split(commaOrNewLine);

					// get user string response and convert it to time!
					if (timeToTasks.length > 1) {
						// entered via comma or \n (30 min, 45 min) and requires old method
						timeToTasks.forEach((time) => {
							var minutes = convertTimeStringToMinutes(time);
							if (minutes > 0)
								timeToTasksArray.push(minutes);
						});
					} else {
						// user entered only one time (1 hr 35 min) and we can use wit intelligence
						// now that we ask one at a time, we can use wit duration
						var customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
						if (customTimeObject) {
							var minutes;
							if (duration) {
								minutes = witDurationToMinutes(duration);
							} else { // cant currently handle datetime cuz wit sucks
								minutes = convertTimeStringToMinutes(response.text);
								// this should be done through datetime, but only duration for now
								// minutes = parseInt(moment.duration(customTimeObject.diff(now)).asMinutes());
							}
						} else {
							minutes = convertTimeStringToMinutes(response.text);
						}

						if (minutes > 0)
							timeToTasksArray.push(minutes);
					}

					taskArray = mapTimeToTaskArray(taskArray, timeToTasksArray);

					// update message for the user
					options         = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);
					attachments     = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

					updateTaskListMessageObject.text        = mainText;
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
		}
	]);

}

function saveNewTaskResponses(tasksToAdd, convo) {

	// get the newTasks!
	var { dailyTasks, newTasks } = convo.tasksEdit;

	if (tasksToAdd) {

		// only get the new tasks
		var tasksArray = [];
		tasksToAdd.forEach((task) => {
			if (task.newTask) {
				tasksArray.push(task);
			}
		})
		var tasksToAddArray = convertResponseObjectsToTaskArray(tasksArray);
		if (!dailyTasks) {
			dailyTasks = [];
		}

		tasksToAddArray.forEach((newTask) => {
			newTasks.push(newTask);
		})

		convo.tasksEdit.dailyTasks = dailyTasks; // all daily tasks
		convo.tasksEdit.newTasks   = newTasks; // only the new ones

	}

	convo.next();
}

// used for both edit time to tasks, as well as add new tasks!!
function confirmTimeToTasks(convo) {

	var { dailyTasks, dailyTasksToUpdate, newTasks } = convo.tasksEdit;

	convo.ask("Are those times right?", [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {

				convo.say("Excellent!");

				// you use this function for either ADDING tasks or UPDATING tasks (one or the other)
				if (newTasks.length > 0) {
					// you added new tasks and are confirming time for them
					addNewTasksToTaskList(response, convo);
				} else if (dailyTasksToUpdate.length > 0) {

					// say task list, then ask which ones to complete
					let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };
					sayTasksForToday(convo, options);

				}

				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {

				convo.say("Let's give this another try :repeat_one:");
				convo.say("Just say time estimates, like `30, 1 hour, or 15 min` and I'll figure it out and assign times to the tasks above in order :smiley:");

				if (newTasks.length > 0) {
					getTimeToTasks(response, convo);
				} else if (dailyTasksToUpdate.length > 0) {
					editTaskTimesFlow(response, convo);
				}
				
				convo.next();
			}
		}
	]);
}

function addNewTasksToTaskList(response, convo) {
	// combine the newTasks with dailyTasks
	var { dailyTasks, newTasks } = convo.tasksEdit;

	var taskArray = [];
	dailyTasks.forEach((task) => {
		taskArray.push(task);
	})
	newTasks.forEach((newTask) => {
		taskArray.push(newTask);
	});

	var taskListMessage = convertArrayToTaskListMessage(taskArray, {onlyRemainingTasks: true});

	// say task list, then ask which ones to complete
	let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true, customTaskListMessage: taskListMessage };
	// sayTasksForToday(convo, options);
	checkForNoRemainingTasks(convo);
	sayWorkSessionMessage(convo);

	convo.next();

}

/**
 * 		~~ WORK ON TASK ~~
 */

// confirm user wants to do work session
function singleLineWorkOnTask(convo, taskNumbersToWorkOnArray) {

	let { tasksEdit: { dailyTasks } } = convo;
	let dailyTasksToWorkOn = [];

	dailyTasks.forEach((dailyTask, index) => {
		const { dataValues: { priority } } = dailyTask;
		if (taskNumbersToWorkOnArray.indexOf(priority) > -1) {
			dailyTasksToWorkOn.push(dailyTask);
		}
	});

	if (dailyTasksToWorkOn.length > 0) {

		let taskTextsToWorkOnArray = dailyTasksToWorkOn.map((dailyTask) => {
			let text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
			return text;
		});

		convo.tasksEdit.dailyTasksToWorkOn = dailyTasksToWorkOn;

		let tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

		convo.tasksEdit.startSession = true;
		convo.say(" ");
		convo.next();

	} else {
		convo.say(`I couldn't find that task to work on`);
		// say task list, then ask which ones to complete
		let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };
		// sayTasksForToday(convo, options);
	}

	convo.next();

}

// work on which task flow
function workOnTasksFlow(convo) {

	let { tasksEdit: { bot, dailyTasks, changePlanCommand, changedPlanCommands } } = convo;

	// say task list, then ask which ones to complete
	let options = { onlyRemainingTasks: true, startPlan: true };

	let baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = `Okay! Which of your task(s) above would you like to`;
	} else {
		baseMessage = `Which of your task(s) above would you like to`;
		sayTasksForToday(convo, options);
	}

	let wordSwapCount = 0;
	let message       = wordSwapMessage(baseMessage, "work on?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [ {
			attachment_type: 'default',
			callback_id: "TASK_WORK",
			fallback: "Which of your task(s) would you like to work on?"
		}]
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {

				// delete the plan if "never mind"
				deleteMostRecentPlanMessage(response.channel, bot);

				convo.say("Okay, let me know if you still want to work on a task :muscle: ");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { text } = response;
				if (response.actions && response.actions[0]) {
					text = response.actions[0].value;
				}

				// if key word exists, we are stopping early and do the other flow!
				if (TASK_DECISION.add.reg_exp.test(text) || TASK_DECISION.complete.reg_exp.test(text) || TASK_DECISION.delete.reg_exp.test(text)) {

					// let's delete the most recent ask message
					deleteConvoAskMessage(response.channel, bot);

					// handling add task flow differently -- we will delete plan for now
					if (TASK_DECISION.add.reg_exp.test(text)) {
						deleteMostRecentPlanMessage(response.channel, bot);
					}

					changePlanCommand.decision = true;
					changePlanCommand.text     = text
				}

				if (changePlanCommand.decision) {
					convo.stop();
					convo.next();
				} else {

					if (TASK_DECISION.work.reg_exp.test(text)) {

						// if user tries completing task again, just update the text
						wordSwapCount++;
						let text = wordSwapMessage(baseMessage, "work on?", wordSwapCount);
						let convoAskQuestionUpdate = getMostRecentMessageToUpdate(response.channel, bot);
						if (convoAskQuestionUpdate) {
							convoAskQuestionUpdate.text = text;
							bot.api.chat.update(convoAskQuestionUpdate);
						}

					} else {

						// otherwise do the expected, default decision!
						let taskNumbersToWorkOnArray = convertTaskNumberStringToArray(response.text, dailyTasks);
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

			}
		}
	]);

	convo.next();

}
