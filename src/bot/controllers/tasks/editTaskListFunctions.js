import os from 'os';
import { wit } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues, FINISH_WORD, RESET, taskListMessageDoneButtonAttachment, taskListMessageAddMoreTasksAndResetTimesButtonAttachment, taskListMessageAddMoreTasksButtonAttachment, pausedSessionOptionsAttachments, startSessionOptionsAttachments, TASK_DECISION } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertResponseObjectsToTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, getMostRecentTaskListMessageToUpdate, getMostRecentMessageToUpdate, deleteConvoAskMessage, convertMinutesToHoursString, getTimeToTaskTextAttachmentWithTaskListMessage } from '../../lib/messageHelpers';

import { consoleLog, witTimeResponseToTimeZoneObject, witDurationToMinutes, mapTimeToTaskArray } from '../../lib/miscHelpers';

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
			sayTasksForToday(convo);
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
			sayTasksForToday(convo);
			convo.say("You can complete, delete, or add tasks to this list ( `complete task 2` or `add tasks`)!");
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
	}

}

function sayTasksForToday(convo, options = {}) {

	const { tasksEdit: { dailyTasks, newTasks } } = convo;
	let remainingTasks = getRemainingTasks(dailyTasks, newTasks);

	if (dailyTasks.length > 0 && (!options.onlyRemainingTasks || (options.onlyRemainingTasks && remainingTasks.length > 0))) {
		options.segmentCompleted = true;
		let taskListMessage = convertArrayToTaskListMessage(dailyTasks, options);

		let taskMessage = "Here are your tasks for today :memo::"
		if (options.onlyRemainingTasks) {
			taskMessage = "Here are your remaining tasks for today :memo::";
		}
		if (!options.noTitle) {
			convo.say(taskMessage);
		}
		convo.say({
			text: taskListMessage,
			attachments:[
				{
					attachment_type: 'default',
					callback_id: "TASK_LIST_MESSAGE",
					fallback: "Here's your task list!"
				}
			]
		});
	}

}

/**
 * 		~~ COMPLETE TASKS ~~
 */

// complete the tasks requested
function singleLineCompleteTask(convo, taskNumbersToCompleteArray) {

	let { dailyTasks, dailyTaskIdsToComplete, taskDecision } = convo.tasksEdit;
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

		/**
		 * 		Provide context specific question if still in certain context
		 * 		right now, only word.
		 */
		switch (taskDecision) {
			case TASK_DECISION.delete.word:
				// delete
				deleteTasksFlow(convo);
				break;
			case TASK_DECISION.work.word:
				// work
				workOnTasksFlow(convo);
				break;
			default:
				// default for this context
				let options = { onlyRemainingTasks: true };
				sayTasksForToday(convo, options);
				checkForNoRemainingTasks(convo);
				break;
		}

	} else {
		convo.say("I couldn't find that task to complete!");
		completeTasksFlow(convo);
	}

	convo.next();

}

function completeTasksFlow(convo) {

	let { tasksEdit: { dailyTasks } } = convo;

	// say task list, then ask which ones to complete
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true };
	sayTasksForToday(convo, options);

	let message = `Which of your task(s) above would you like to complete?`;
	convo.ask(message, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say("Okay, let me know if you still want to complete tasks! :wave: ");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				let { text } = response;
				let taskNumbersToCompleteArray = convertTaskNumberStringToArray(text, dailyTasks);
				if (taskNumbersToCompleteArray) {
					switch (text) {
						case (text.match(TASK_DECISION.complete.reg_exp) || {}).input:
							// complete
							singleLineCompleteTask(convo, taskNumbersToCompleteArray);
							break;
						case (text.match(TASK_DECISION.add.reg_exp) || {}).input:
							// add
							addTasksFlow(convo);
							break;
						case (text.match(TASK_DECISION.delete.reg_exp) || {}).input:
							// delete
							singleLineDeleteTask(convo, taskNumbersToCompleteArray);
							break;
						case (text.match(TASK_DECISION.work.reg_exp) || {}).input:
							// work on task
							singleLineWorkOnTask(convo, taskNumbersToCompleteArray);
							break;
						default:
							// default for this context
							singleLineCompleteTask(convo, taskNumbersToCompleteArray);
							break;
					}
				} else if (text.match(TASK_DECISION.add.reg_exp)) {
						addTasksFlow(convo);
				} else {
					convo.say("Oops, I don't totally understand :dog:. Let's try this again");
					convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
					convo.repeat();
				}
				convo.next();
			}
		}
	]);

	convo.next();

}


/**
 * 		~~ DELETE TASKS ~~
 */

function singleLineDeleteTask(convo, taskNumbersToDeleteArray) {

	let { dailyTasks, dailyTaskIdsToDelete, taskDecision } = convo.tasksEdit;
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

		/**
		 * 		Provide context specific question if still in certain context
		 * 		right now, only word.
		 */
		switch (taskDecision) {
			case TASK_DECISION.complete.word:
				// complete
				completeTasksFlow(convo);
				break;
			case TASK_DECISION.work.word:
				// work
				workOnTasksFlow(convo);
				break;
			default:
				// default for this context
				let options = { onlyRemainingTasks: true };
				sayTasksForToday(convo, options);
				checkForNoRemainingTasks(convo);
				break;
		}

	} else {
		convo.say("I couldn't find that task to delete!");
		deleteTasksFlow(convo);
	}

	convo.next();

}

function deleteTasksFlow(convo) {

	let { tasksEdit: { dailyTasks } } = convo;

	// say task list, then ask which ones to complete
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true };
	sayTasksForToday(convo, options);

	let message = `Which of your task(s) above would you like to delete?`;
	convo.ask(message, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say("Okay, let me know if you still want to delete tasks! :wave: ");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				let { text } = response;
				let taskNumbersToDeleteArray = convertTaskNumberStringToArray(text, dailyTasks);
				if (taskNumbersToDeleteArray) {
					switch (text) {
						case (text.match(TASK_DECISION.complete.reg_exp) || {}).input:
							// complete
							singleLineCompleteTask(convo, taskNumbersToDeleteArray);
							break;
						case (text.match(TASK_DECISION.add.reg_exp) || {}).input:
							// add
							addTasksFlow(convo);
							break;
						case (text.match(TASK_DECISION.delete.reg_exp) || {}).input:
							// delete
							singleLineDeleteTask(convo, taskNumbersToDeleteArray);
							break;
						case (text.match(TASK_DECISION.work.reg_exp) || {}).input:
							// work on task
							singleLineWorkOnTask(convo, taskNumbersToDeleteArray);
							break;
						default:
							// default for this context
							singleLineDeleteTask(convo, taskNumbersToDeleteArray);
							break;
					}
				} else if (text.match(TASK_DECISION.add.reg_exp)) {
						addTasksFlow(convo);
				} else {
					convo.say("Oops, I don't totally understand :dog:. Let's try this again");
					convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
					convo.repeat();
				}
				convo.next();
			}
		}
	]);

	convo.next();
	
}

/**
 * 		~~ ADD TASKS ~~
 */

function addTasksFlow(convo) {

	var { source_message, tasksEdit: { bot, dailyTasks, newTasks, actuallyWantToAddATask } } = convo;

	// say task list, then ask for user to add tasks
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true };
	let taskListMessage = convertArrayToTaskListMessage(dailyTasks, options);

	var tasksToAdd = [];
	convo.say("Let's do it! What other tasks do you want to work on?");
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

				let { dailyTask } = convo.tasksEdit;

				let tasksToAddArray = convertResponseObjectsToTaskArray(tasksToAdd);
				if (!dailyTasks) {
					dailyTasks = [];
				}
				convo.tasksEdit.dailyTasks = dailyTasks; // all daily tasks
				if (!newTasks) {
					newTasks = [];
				}

				tasksToAddArray.forEach((task) => {
					newTasks.push(task);
				});
				convo.tasksEdit.newTasks = newTasks;

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

				let { dailyTask } = convo.tasksEdit;

				let tasksToAddArray = convertResponseObjectsToTaskArray(tasksToAdd);
				if (!dailyTasks) {
					dailyTasks = [];
				}
				convo.tasksEdit.dailyTasks = dailyTasks; // all daily tasks
				if (!newTasks) {
					newTasks = [];
				}

				tasksToAddArray.forEach((task) => {
					newTasks.push(task);
				});
				convo.tasksEdit.newTasks = newTasks;

				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.neverMind.value
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {
				convo.say("Okay! Let me know whenever you want to add more tasks");
				convo.next();
			}
		},
		{
			default: true,
			callback: function(response, convo) {

				let updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				const { text } = response;
				const newTask = {
					text
				}

				tasksToAdd.push(newTask);

				options = { onlyRemainingTasks: true, dontCalculateMinutes: true };
				if (actuallyWantToAddATask) {
					options.dontCalculateMinutes = true;
					// taskListMessage = convertArrayToTaskListMessage(taskArray, options)
				} else {
					options.segmentCompleted = true;
					options.newTasks = tasksToAdd;
					taskListMessage = convertArrayToTaskListMessage(dailyTasks, options)
				}

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
				addTasksFlow(response, convo);
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

// used for both edit time to tasks, as well as add new tasks!!
function confirmTimeToTasks(convo) {

	var { dailyTasks, dailyTasksToUpdate, newTasks, taskDecision } = convo.tasksEdit;

	convo.ask("Are those times right?", [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {

				convo.say("Excellent!");

				// you use this function for either ADDING tasks or UPDATING tasks (one or the other)
				if (newTasks.length > 0) {
					// you added new tasks and are confirming time for them
					addNewTasksToTaskList(response, convo);
				}

				/**
				 * 		Provide context specific question if still in certain context
				 * 		right now, only word.
				 */
				switch (taskDecision) {
					case TASK_DECISION.delete.word:
						// delete
						deleteTasksFlow(convo);
						break;
					case TASK_DECISION.complete.word:
						// complete
						completeTasksFlow(convo);
						break;
					case TASK_DECISION.work.word:
						// work
						workOnTasksFlow(convo);
						break;
					default:
						break;
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
	var { dailyTasks, newTasks, UserId } = convo.tasksEdit;
	var options                  = { segmentCompleted: true };

	var taskArray = [];
	let priority = 0;
	dailyTasks.forEach((dailyTask) => {
		const { dataValues: { type, Task: { done } } } = dailyTask;
		if (!done && type == "live") {
			priority++;
		}
		taskArray.push(dailyTask);
	})

	let count = 0;
	newTasks.forEach((newTask) => {
		priority++;
		let { minutes, text } = newTask;
		if (minutes && text) {
			models.Task.create({
				text
			})
			.then((task) => {
				const TaskId = task.id;
				models.DailyTask.create({
					TaskId,
					priority,
					minutes,
					UserId
				})
				.then(() => {
					count++;
					if (count == newTasks.length) {
						prioritizeDailyTasks(user);
					}
				})
			})
		}
		taskArray.push({
			...newTask,
			text,
			priority,
			type: "live",
			Task: {
				text,
				done: false,
				UserId
			},
			dataValues: {
				...newTask,
				text,
				priority,
				type: "live",
				Task: {
					text,
					done: false,
					UserId
				}
			}
		})
	});

	convo.tasksEdit.newTasks = []; // reset after inserting

	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);
	convo.tasksEdit.dailyTasks = taskArray;
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
		let options = { onlyRemainingTasks: true };
		sayTasksForToday(convo, options);
	}

	convo.next();

}

// work on which task flow
function workOnTasksFlow(convo) {

	let { tasksEdit: { dailyTasks } } = convo;

	dailyTasks = dailyTasks.filter((dailyTask, index) => {
		const { dataValues: { priority, type, Task: { done } } } = dailyTask;
		return (!done && type == "live");
	});

	// say task list, then ask which ones to complete
	let options = { onlyRemainingTasks: true };
	sayTasksForToday(convo, options);

	if (dailyTasks.length > 0) {
		let message = `Which of your task(s) above would you like to work on?`;
		convo.ask(message, [
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say("Okay, let me know if you still want to work on a task :muscle: ");
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {
					let { text } = response;
					let taskNumbersToWorkOnArray = convertTaskNumberStringToArray(text, dailyTasks);
					if (taskNumbersToWorkOnArray) {
						switch (text) {
							case (text.match(TASK_DECISION.complete.reg_exp) || {}).input:
								// complete
								singleLineCompleteTask(convo, taskNumbersToWorkOnArray);
								break;
							case (text.match(TASK_DECISION.add.reg_exp) || {}).input:
								// add
								addTasksFlow(convo);
								break;
							case (text.match(TASK_DECISION.delete.reg_exp) || {}).input:
								// delete
								singleLineDeleteTask(convo, taskNumbersToWorkOnArray);
								break;
							case (text.match(TASK_DECISION.work.reg_exp) || {}).input:
								// work on task
								singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
								break;
							default:
								// default for this context
								singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
								break;
						}
						convo.next();
					} else if (text.match(TASK_DECISION.add.reg_exp)) {
						addTasksFlow(convo);
						convo.next();
					} else {
						convo.say("Oops, I don't totally understand :dog:. Let's try this again");
						convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
						convo.repeat();
					}
					convo.next();
				}
			}
		]);
	}

	convo.next();

}
