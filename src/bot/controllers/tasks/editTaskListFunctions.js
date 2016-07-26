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
				let options = { onlyRemainingTasks: true };
				sayTasksForToday(convo, options);
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
				let options = { onlyRemainingTasks: true };
				sayTasksForToday(convo, options);
			} else {
				deleteTasksFlow(convo);
			}
			break;
		case TASK_DECISION.edit.word:
			console.log(`\n\n ~~ user wants to edit tasks in specificCommandFlow ~~ \n\n`)
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
	checkForNoRemainingTasks(convo);

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

	const { tasksEdit: { dailyTasks } } = convo;

	if (dailyTasks.length > 0) {
		options.segmentCompleted = true;
		let taskListMessage = convertArrayToTaskListMessage(dailyTasks, options);

		let taskMessage = "Here are your tasks for today :memo::"
		if (options.onlyRemainingTasks) {
			taskMessage = "Here are your remaining tasks for today :memo::";
		}
		convo.say(taskMessage);
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

	let { dailyTasks, dailyTaskIdsToComplete } = convo.tasksEdit;
	let dailyTasksToComplete = [];
	dailyTasks = dailyTasks.filter((dailyTask, index) => {
		const { dataValues: { priority } } = dailyTask;
		let stillNotCompleted = true;
		if (taskNumbersToCompleteArray.indexOf(priority) > -1) {
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

		convo.say(`Great work :punch: I checked off ${dailyTasksToCompleteString}!`);

		// add to complete array for tasksEdit
		dailyTaskIdsToComplete = dailyTasksToComplete.map((dailyTask) => {
			return dailyTask.dataValues.id;
		});
		convo.tasksEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;

	} else {
		convo.say(`Ah, I didn't find that task to complete`);
	}

	convo.next();

}

function completeTasksFlow(convo) {

	let { tasksEdit: { dailyTasks } } = convo;

	// say task list, then ask which ones to complete
	sayTasksForToday(convo);

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
				let taskNumbersToCompleteArray = convertTaskNumberStringToArray(response.text, dailyTasks);
				if (taskNumbersToCompleteArray) {
					singleLineCompleteTask(convo, taskNumbersToCompleteArray);
					let options = { onlyRemainingTasks: true };
					sayTasksForToday(convo, options);
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

	let { dailyTasks, dailyTaskIdsToDelete } = convo.tasksEdit;
	let dailyTasksToDelete = [];
	dailyTasks = dailyTasks.filter((dailyTask, index) => {
		const { dataValues: { priority } } = dailyTask;
		let stillNotDeleted = true;
		if (taskNumbersToDeleteArray.indexOf(priority) > -1) {
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

		convo.say(`Sounds good, I deleted ${dailyTasksToDeleteString}!`);

		// add to delete array for tasksEdit
		dailyTaskIdsToDelete = dailyTasksToDelete.map((dailyTask) => {
			return dailyTask.dataValues.id;
		});
		convo.tasksEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;

	} else {
		convo.say(`Ah, I didn't find that task to delete`);
	}

	convo.next();

}

function deleteTasksFlow(convo) {

	let { tasksEdit: { dailyTasks } } = convo;

	// say task list, then ask which ones to complete
	sayTasksForToday(convo);

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
				let taskNumbersToDeleteArray = convertTaskNumberStringToArray(response.text, dailyTasks);
				if (taskNumbersToDeleteArray) {
					singleLineDeleteTask(convo, taskNumbersToDeleteArray);
					let options = { onlyRemainingTasks: true };
					sayTasksForToday(convo, options);
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
				if (actuallyWantToAddATask) {
					options.dontCalculateMinutes = true;
					taskListMessage = convertArrayToTaskListMessage(taskArray, options)
				} else {
					options.segmentCompleted = true;
					options.newTasks = taskArray;
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
					// editing time to tasks
					var options = { dontUseDataValues: true, segmentCompleted: true };
					var fullTaskListMessage = convertArrayToTaskListMessage(dailyTasksToUpdate, options);

					convo.say("Here's your remaining task list :memo::");
					convo.say(fullTaskListMessage);

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
	var options                  = { segmentCompleted: true };

	var taskArray = [];
	dailyTasks.forEach((task) => {
		taskArray.push(task);
	})
	newTasks.forEach((newTask) => {
		taskArray.push(newTask);
	});

	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	convo.say("Here's your updated task list :memo::");
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

		convo.say(`Let's do it! :weight_lifter:`);
		convo.tasksEdit.startSession = true;
		convo.next();

	} else {
		convo.say(`Ah, I didn't find that task to work on`);
	}

	convo.next();

}

// work on which task flow
function workOnTasksFlow(convo) {

	let { tasksEdit: { dailyTasks } } = convo;

	// say task list, then ask which ones to complete
	sayTasksForToday(convo);

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
	]);

	convo.next();

}

/**
 * 			DEPRECATED FUNCTIONS 7/25/16
 */

// options to ask if user has at least 1 remaining task
function askForTaskListOptions(convo) {

	const { tasksEdit: { dailyTasks, bot } } = convo;

	// see if remaining tasks or not
	var remainingTasks = [];
	dailyTasks.forEach((dailyTask) => {
		if (!dailyTask.dataValues.Task.done) {
			remainingTasks.push(dailyTask);
		}
	});

	if (remainingTasks.length == 0) {
		askForTaskListOptionsIfNoRemainingTasks(convo);
		return;
	}

	convo.ask({
		text: `What would you like to do? \`i.e. complete tasks 1 and 2\``,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "EDIT_TASKS",
				color: colorsHash.turquoise.hex,
				fallback: "How do you want to edit tasks?",
				actions: [
					{
							name: buttonValues.addTasks.name,
							text: "Add tasks",
							value: buttonValues.addTasks.value,
							type: "button"
					},
					{
							name: buttonValues.markComplete.name,
							text: "Complete :heavy_check_mark:",
							value: buttonValues.markComplete.value,
							type: "button"
					},
					{
							name: buttonValues.editTaskTimes.name,
							text: "Edit times",
							value: buttonValues.editTaskTimes.value,
							type: "button"
					},
					{
							name: buttonValues.deleteTasks.name,
							text: "Remove tasks",
							value: buttonValues.deleteTasks.value,
							type: "button",
							style: "danger"
					},
					{
							name: buttonValues.neverMindTasks.name,
							text: "Nothing!",
							value: buttonValues.neverMindTasks.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.addTasks.value,
			callback: function(response, convo) {
				addTasksFlow(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.addTasks.value
			pattern: utterances.containsAdd,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Okay, let's add some tasks :muscle:");
				addTasksFlow(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.markComplete.value,
			callback: function(response, convo) {
				completeTasksFlow(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.markComplete.value
			pattern: utterances.containsCompleteOrCheckOrCross,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				var { dailyTasks } = convo.tasksEdit;
				var taskNumbersToCompleteArray = convertTaskNumberStringToArray(response.text, dailyTasks);
				if (taskNumbersToCompleteArray) {
					// single line complete ability
					confirmCompleteTasks(response, convo);
				} else {
					completeTasksFlow(response, convo);
				}

				convo.next();
			}
		},
		{
			pattern: buttonValues.deleteTasks.value,
			callback: function(response, convo) {
				deleteTasksFlow(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.deleteTasks.value
			pattern: utterances.containsDeleteOrRemove,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				var { dailyTasks } = convo.tasksEdit;
				var taskNumbersToCompleteArray = convertTaskNumberStringToArray(response.text, dailyTasks);
				if (taskNumbersToCompleteArray) {
					// single line complete ability
					confirmDeleteTasks(response, convo);
				} else {
					deleteTasksFlow(response, convo);
				}

				convo.next();
			}
		},
		{
			pattern: buttonValues.editTaskTimes.value,
			callback: function(response, convo) {
				editTaskTimesFlow(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.editTaskTimes.value
			pattern: utterances.containsTime,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Let's do this :hourglass:");
				editTaskTimesFlow(response, convo);
				convo.next();
			}
		},
		{ // if user lists tasks, we can infer user wants to start a specific session
			pattern: utterances.containsNumber,
			callback: (response, convo) => {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				var tasksToWorkOnString      = response.text;
				var taskNumbersToWorkOnArray = convertTaskNumberStringToArray(tasksToWorkOnString, dailyTasks);

				if (!taskNumbersToWorkOnArray) {
					convo.say("You didn't pick a valid task to work on :thinking_face:");
					convo.say("You can pick a task from your list `i.e. tasks 1, 3` to work on");
					askForTaskListOptions(response, convo);
					return;
				}

				var dailyTasksToWorkOn = [];
				dailyTasks.forEach((dailyTask, index) => {
					var taskNumber = index + 1; // b/c index is 0-based
					if (taskNumbersToWorkOnArray.indexOf(taskNumber) > -1) {
						dailyTasksToWorkOn.push(dailyTask);
					}
				});

				convo.tasksEdit.dailyTasksToWorkOn = dailyTasksToWorkOn;
				confirmWorkSession(convo);

				convo.next();
			}
		},
		{
			pattern: buttonValues.neverMindTasks.value,
			callback: function(response, convo) {
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.neverMind.value
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				const { tasksEdit: { currentSession } } = convo;

				convo.say("Okay! No worries :smile_cat:")

				if (currentSession) {

					const { minutesString, sessionTasks, endTimeString } = currentSession;

					if (currentSession.isPaused) {
						// paused session
						convo.say({
							text: `Let me know when you want to resume your session for ${sessionTasks}!`,
							attachments: pausedSessionOptionsAttachments
						});
					} else {
						// live session
						convo.say({
							text: `Good luck with ${sessionTasks}! See you at *${endTimeString}* :timer_clock:`,
							attachments: startSessionOptionsAttachments
						});
					}
				}
				
				convo.next();

			}
		},
		{ // this is failure point. restart with question
			default: true,
			callback: function(response, convo) {
				convo.say("I didn't quite get that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);
}


// options to ask if user has no remaining tasks
function askForTaskListOptionsIfNoRemainingTasks(convo) {

	var { tasksEdit: { bot } } = convo;

	convo.ask({
		text: `You have no remaining tasks for today. Would you like to add some tasks?`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "ADD_TASKS",
				color: colorsHash.turquoise.hex,
				fallback: "Let's add some tasks?",
				actions: [
					{
							name: buttonValues.addTasks.name,
							text: "Add tasks",
							value: buttonValues.addTasks.value,
							type: "button"
					},
					{
							name: buttonValues.neverMindTasks.name,
							text: "Good for now!",
							value: buttonValues.neverMindTasks.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.addTasks.value,
			callback: function(response, convo) {
				addTasksFlow(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.addTasks.value
			pattern: utterances.containsAdd,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Okay, let's add some tasks :muscle:");
				addTasksFlow(response, convo);
				convo.next();

			}
		},
		{ // NL equivalent to buttonValues.addTasks.value
			pattern: utterances.yes,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Okay, let's add some tasks :muscle:");
				addTasksFlow(response, convo);
				convo.next();

			}
		},
		{
			pattern: buttonValues.neverMindTasks.value,
			callback: function(response, convo) {
				convo.say("Let me know whenever you're ready to `add tasks`");
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.neverMindTasks.value
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Okay! I didn't add any :smile_cat:");
				convo.say("Let me know whenever you're ready to `add tasks`");
				convo.next();
			}
		},
		{ // this is failure point. restart with question
			default: true,
			callback: function(response, convo) {
				convo.say("I didn't quite get that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);
}


/**
 * 			~~ EDIT TIMES TO TASKS FLOW ~~
 */

function editTaskTimesFlow(response, convo) {

	var { tasksEdit: { bot, dailyTasks, dailyTasksToUpdate } } = convo;
	

	var dailyTasksToSetMinutes = [];
	// for all the remaining daily tasks
	dailyTasks.forEach((dailyTask) => {
		if (dailyTask.dataValues && !dailyTask.dataValues.Task.done) {
			dailyTasksToSetMinutes.push(dailyTask);
		}
	});

	convo.tasksEdit.dailyTasksToSetMinutes = dailyTasksToSetMinutes;

	var options = { dontShowMinutes: true, dontCalculateMinutes: true };
	var taskListMessage = convertArrayToTaskListMessage(dailyTasksToSetMinutes, options);
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

	getTimeToTasks(response, convo);

}