import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput, convertTaskNumberStringToArray, getMostRecentTaskListMessageToUpdate, deleteConvoAskMessage, convertResponseObjectToNewTaskArray, getTimeToTaskTextAttachmentWithTaskListMessage, commaSeparateOutTaskArray } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';
import { FINISH_WORD, EXIT_EARLY_WORDS, NONE, RESET, colorsHash, buttonValues, taskListMessageDoneButtonAttachment, taskListMessageDoneAndDeleteButtonAttachment, taskListMessageAddMoreTasksAndResetTimesButtonAttachment, taskListMessageAddMoreTasksButtonAttachment, taskListMessageYesButtonAttachment, taskListMessageNoButtonsAttachment } from '../../lib/constants';
import { consoleLog } from '../../lib/miscHelpers';

import { resumeQueuedReachouts } from '../index';


/**
 * 		START DAY CONVERSATION FLOW FUNCTIONS
 */


// show user previous pending tasks to decide on them
export function showPendingTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	var { pendingTasks }          = convo.dayStart;

	var options = {
		dontShowMinutes: true,
		dontCalculateMinutes: true
	}
	var taskListMessage = convertArrayToTaskListMessage(pendingTasks, options);
	convo.say("Which of these outstanding tasks would you still like to work on? Just tell me the numbers `i.e. tasks 1, 3 and 4`");
	convo.ask({
		text: taskListMessage,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "PENDING_TASKS",
				fallback: "Which tasks do you want to work on today?",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.allPendingTasks.name,
							text: "All of them",
							value: buttonValues.allPendingTasks.value,
							type: "button"
					},
					{
							name: buttonValues.noPendingTasks.name,
							text: "None of these",
							value: buttonValues.noPendingTasks.value,
							type: "button"
					},
					{
							name: buttonValues.neverMind.name,
							text: "Never mind!",
							value: buttonValues.neverMind.value,
							type: "button",
							style: "danger"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.allPendingTasks.value,
			callback: function(response, convo) {
				convo.dayStart.taskArray = pendingTasks;
				askForAdditionalTasks(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.allPendingTasks.value
			pattern: utterances.containsAll,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("I like all those tasks too :open_hands:");
				convo.dayStart.taskArray = pendingTasks;
				askForAdditionalTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.noPendingTasks.value,
			callback: function(response, convo) {
				askForDayTasks(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.noPendingTasks.value
			pattern: utterances.containsNone,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("I like a fresh start each day, too");
				askForDayTasks(response, convo);
				convo.next();
			}
		},
		{ // user inserts some task numbers
			pattern: utterances.containsNumber,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				savePendingTasksToWorkOn(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.neverMind.value,
			callback: function(response, convo) {
				convo.stop();
				convo.next();
			}
		},
		{ // same as never mind button
			pattern: utterances.startsWithNever,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.stop();
				convo.next();
			}
		},
		{ // this is failure point
			default: true,
			callback: function(response, convo) {
				convo.say("I didn't quite get that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);

}

function savePendingTasksToWorkOn(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	var { pendingTasks }          = convo.dayStart; // ported from beginning of convo flow

	// get tasks from array
	var userInput                = response.text; // i.e. `1, 3, 4, 2`
	var taskNumbersToWorkOnArray = convertTaskNumberStringToArray(userInput, pendingTasks);

	// means user input is invalid
	if (!taskNumbersToWorkOnArray) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		showPendingTasks(response, convo);
		return;
	} else {
		var taskArray = [];
		// save this to keep moving on!
		taskNumbersToWorkOnArray.forEach((taskNumber) => {
			var index = taskNumber - 1; // make this 0-index based
			if (pendingTasks[index])
				taskArray.push(pendingTasks[index]);
		});
		convo.dayStart.taskArray = taskArray;
	}

	convo.say("This is starting to look good :sunglasses:");
	askForAdditionalTasks(response, convo);

}

function askForAdditionalTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	var tasks = [];

	convo.say("Which *additional tasks* would you like to work on with me today? Please send me each task in a separate line");
	addMoreTasks(response, convo);

}

// convo flow to delete tasks from task list
function deleteTasksFromList(response, convo) {

	const { task, dayStart: { taskArray } } = convo;
	const { bot, source_message }           = task;

	var message = `Which of your task(s) would you like to delete?`;
	var options = { dontShowMinutes: true, dontCalculateMinutes: true };
	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	convo.ask({
		text: `${message}\n${taskListMessage}`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "TASK_LIST_MESSAGE",
				fallback: "Which tasks do you want to delete?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.neverMind.name,
						text: "Never mind!",
						value: buttonValues.neverMind.value,
						type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: buttonValues.neverMind.value,
			callback: (response, convo) => {

				askForAdditionalTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Okay, let's get back to your list!");
				askForAdditionalTasks(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				confirmDeleteTasks(response, convo, taskArray);
				convo.next();
			}
		}
	]);
}

function confirmDeleteTasks(response, convo) {

	const { task, dayStart: { taskArray } } = convo;
	const { bot, source_message }           = task;

	var tasksToDeleteString = response.text;

	// if we capture 0 valid tasks from string, then we start over
	var taskNumbersToDeleteArray = convertTaskNumberStringToArray(tasksToDeleteString, taskArray);
	if (!taskNumbersToDeleteArray) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
		deleteTasksFromList(response, convo);
		return;
	}

	var tasksToDelete = [];
	taskArray.forEach((dailyTask, index) => {
		var taskNumber = index + 1; // b/c index is 0-based
		if (taskNumbersToDeleteArray.indexOf(taskNumber) > -1) {
			if (dailyTask.dataValues) {
				dailyTask = dailyTask.dataValues;
			}
			tasksToDelete.push(dailyTask);
		}
	});	

	var taskTextsToDelete = tasksToDelete.map((dailyTask) => {
		return dailyTask.text;
	});

	var tasksString = commaSeparateOutTaskArray(taskTextsToDelete);

	var newTaskArray = [];
	convo.ask(`So you would like to delete ${tasksString}?`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {

				taskArray.forEach((task) => {
					if (task.dataValues) {
						task = task.dataValues;
					}
					if (taskTextsToDelete.indexOf(task.text) < 0) {
						newTaskArray.push(task);
					}
				});
				convo.dayStart.taskArray = newTaskArray;

				// go back to flow
				convo.say("Sounds great, deleted!");
				askForAdditionalTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay, let's try this again!");
				deleteTasksFromList(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say("Couldn't quite catch that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);

}

// helper function save convo responses to your taskArray obj
// this will get the new tasks, from whichever part of convo flow
// that you are getting them, then add them to the existing
// `convo.dayStart.taskArray` property
function saveTaskResponsesToDayStartObject(tasks, convo) {

	// add the new tasks to existing pending tasks!
	var { taskArray } = convo.dayStart;

	if (tasks) {

		// only get the new tasks
		var newTasks = [];
		tasks.forEach((task) => {
			if (task.newTask) {
				newTasks.push(task);
			}
		})
		var newTasksArray = convertResponseObjectsToTaskArray(newTasks);
		if (!taskArray) {
			taskArray = [];
		}
		newTasksArray.forEach((task) => {
			taskArray.push(task);
		});
		convo.dayStart.taskArray = taskArray;
	}

}


// user just started conersation and is entering tasks
export function askForDayTasks(response, convo){

	const { task }                = convo;
	const { bot, source_message } = task;

	var tasks = [];

	convo.say(`What tasks would you like to work on today? :pencil: Please send me each task in a separate line`);
	addMoreTasks(response, convo);

}

// if user wants to add more tasks
function addMoreTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	var { taskArray }   = convo.dayStart;
	var options         = { dontShowMinutes: true, dontCalculateMinutes: true };
	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	var tasks = [];
	taskArray.forEach((task) => {
		tasks.push(task);
	});

	var attachments = [
		{
			attachment_type: 'default',
			callback_id: "TASK_LIST_MESSAGE",
			fallback: "Which additional tasks do you want to work on?",
			color: colorsHash.grey.hex
		}
	];

	if (tasks.length > 0 && attachments) {
		// if greater length, then add these actions
		attachments[0].actions = [
			{
					name: buttonValues.noAdditionalTasks.name,
					text: "No additional tasks",
					value: buttonValues.noAdditionalTasks.value,
					type: "button"
			},
			{
					name: buttonValues.deleteTasks.name,
					text: "Delete tasks",
					value: buttonValues.deleteTasks.value,
					type: "button"
			}
		]
	}

	convo.ask({
		text: taskListMessage,
		attachments
	},
	[
		{
			pattern: buttonValues.noAdditionalTasks.value,
			callback: function(response, convo) {
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.doneAddingTasks.value,
			callback: function(response, convo) {
				saveTaskResponsesToDayStartObject(tasks, convo);
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
				saveTaskResponsesToDayStartObject(tasks, convo);
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.noAdditional,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Excellent!");
				getTimeToTasks(response, convo);
				convo.next();

			}
		},
		{
			pattern: buttonValues.deleteTasks.value,
			callback: function(response, convo) {
				saveTaskResponsesToDayStartObject(tasks, convo);
				deleteTasksFromList(response, convo);		
				convo.next();
			}
		},
		{
			pattern: utterances.deleteTasks,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				saveTaskResponsesToDayStartObject(tasks, convo);

				var { taskArray } = convo.dayStart;
				var taskNumbersToCompleteArray = convertTaskNumberStringToArray(response.text, taskArray);
				if (taskNumbersToCompleteArray) {
					// single line complete ability
					confirmDeleteTasks(response, convo);
				} else {
					convo.say("Okay! Let's remove some tasks");
					deleteTasksFromList(response, convo);
				}

				convo.next();

			}
		},
		{
			pattern: utterances.noAdditional,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Excellent!");
				getTimeToTasks(response, convo);
				convo.next();

			}
		},
		{ // this is additional task added in this case.
			default: true,
			callback: function(response, convo) {

				console.log(`~~additional task being added!!!!!~~`);

				var updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				var newTaskArray = convertResponseObjectToNewTaskArray(response);
				newTaskArray.forEach((newTask) => {
					tasks.push(newTask);
				});

				taskListMessage = convertArrayToTaskListMessage(tasks, options)

				updateTaskListMessageObject.text        = taskListMessage;
				updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageDoneAndDeleteButtonAttachment);

				bot.api.chat.update(updateTaskListMessageObject);
				
			}
		}
	]);

}

// ask the question to get time to tasks
function getTimeToTasks(response, convo) {

	var { taskArray, bot } = convo.dayStart;
	var options            = { dontShowMinutes: true, dontCalculateMinutes: true, noKarets: true };
	var taskListMessage    = convertArrayToTaskListMessage(taskArray, options);

	var timeToTasksArray = [];
	var taskTextsArray = taskArray.map((task) => {
		if (task.dataValues) {
			task = task.dataValues;
		}
		return task.text;
	})

	var mainText = "*Let's add time to each of your tasks:*";

	var attachments = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);
	convo.ask({
		text: mainText,
		attachments
	},
	[
		{
			pattern: buttonValues.actuallyWantToAddATask.value,
			callback: function(response, convo) {
				addMoreTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.resetTimes.value,
			callback: (response, convo) => {

				var updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);
				if (updateTaskListMessageObject) {
					convo.dayStart.updateTaskListMessageObject = updateTaskListMessageObject;
					// reset ze task list message
					timeToTasksArray = [];

					var options = { dontShowMinutes: true, dontCalculateMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);

					var message = `How much *time* would you like to allocate to \`${taskTextsArray[timeToTasksArray.length]}\`?`;
					message = `${message}\n${taskListMessage}`;

					updateTaskListMessageObject.text        = "*Let's add time to each of your tasks!*";
					updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageAddMoreTasksButtonAttachment);
					bot.api.chat.update(updateTaskListMessageObject);
				}

				convo.silentRepeat();
			}
		},
		{
			pattern: RESET.reg_exp,
			callback: (response, convo) => {

				var updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);
				if (updateTaskListMessageObject) {
					convo.dayStart.updateTaskListMessageObject = updateTaskListMessageObject;
					// reset ze task list message
					timeToTasksArray = [];
					var options = { dontShowMinutes: true, dontCalculateMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);

					var message = `How much *time* would you like to allocate to \`${taskTextsArray[timeToTasksArray.length]}\`?`;
					message = `${message}\n${taskListMessage}`;

					updateTaskListMessageObject.text        = message;
					updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageAddMoreTasksButtonAttachment);
					bot.api.chat.update(updateTaskListMessageObject);
				}
				
				convo.silentRepeat();

			}
		},
		{
			default: true,
			callback: function(response, convo) {

				var updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				if (updateTaskListMessageObject) {
					convo.dayStart.updateTaskListMessageObject = updateTaskListMessageObject;
					const commaOrNewLine = new RegExp(/[,\n]/);
					var timeToTasks      = response.text.split(commaOrNewLine);

					timeToTasks.forEach((time) => {
						var minutes = convertTimeStringToMinutes(time);
						if (minutes > 0)
							timeToTasksArray.push(minutes);
					});

					taskArray = taskArray.map((task, index) => {
						if (task.dataValues) {
							task = task.dataValues;
						}
						return {
							...task,
							minutes: timeToTasksArray[index]
						}
					});

					var options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);
					var attachments = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

					updateTaskListMessageObject.text        = mainText;
					updateTaskListMessageObject.attachments = JSON.stringify(attachments);

					bot.api.chat.update(updateTaskListMessageObject);

					if (timeToTasksArray.length >= taskArray.length) {

						console.log("~~finish times:~~ \n\n")
						console.log(updateTaskListMessageObject);
						convo.dayStart.taskArray = taskArray;
						confirmTimeToTasks(timeToTasksArray, convo);
						convo.next();

					}
				}

				
				
			}
		}
	]);

}

// this is the work we do to actually assign time to tasks
function confirmTimeToTasks(timeToTasksArray, convo) {

	convo.ask("Are those times right?", [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.say(":boom: This looks great!");
				askToStartWorkSession(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Let's give this another try :repeat_one:");
				convo.say("Just say a time estimate, like `30 min` for each task and I'll assign it to the tasks above in order :smiley:");
				getTimeToTasks(response, convo);
				convo.next();
			}
		}
	]);

}

function askToStartWorkSession(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	convo.ask({
		text: "Ready to start a work session?",
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "WORK_SESSION_DECISIONS",
				fallback: "Ready to start a work session?",
				color: colorsHash.blue.hex,
				actions: [
					{
							name: buttonValues.startNow.name,
							text: "Start session now!",
							value: buttonValues.startNow.value,
							type: "button",
							style: "primary"
					},
					{
						name: buttonValues.remindMe.name,
						text: "Remind me in 10",
						value: buttonValues.remindMe.value,
						type: "button"
					},
					{
						name: buttonValues.backLater.name,
						text: "Be back later",
						value: buttonValues.backLater.value,
						type: "button"
					},
					{
						name: buttonValues.editTaskList.name,
						text: "Edit tasks",
						value: buttonValues.editTaskList.value,
						type: "button"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.startNow.value,
			callback: function(response, convo) {
				convo.dayStart.startDayDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{
			pattern: utterances.yes,
			callback: function(response, convo) {
				
				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);
				convo.dayStart.startDayDecision = intentConfig.START_SESSION;

				convo.next();
			}
		},
		{
			pattern: buttonValues.remindMe.value,
			callback: function(response, convo) {
				convo.dayStart.startDayDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{
			pattern: utterances.containsCheckin,
			callback: function(response, convo) {
				
				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);
				convo.say("Great! I'll check in with you in 10 minutes :smiley:");
				convo.dayStart.startDayDecision = intentConfig.REMINDER;

				convo.next();
			}
		},
		{
			pattern: buttonValues.backLater.value,
			callback: function(response, convo) {
				convo.dayStart.startDayDecision = intentConfig.BACK_LATER;
				convo.next();
			}
		},
		{
			pattern: utterances.containsBackLater,
			callback: function(response, convo) {
				
				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.dayStart.startDayDecision = intentConfig.BACK_LATER;
				convo.say("Okay! Call me whenever you want to get productive `hey toki!` :muscle:");
				convo.next();

			}
		},
		{
			pattern: buttonValues.editTaskList.value,
			callback: function(response, convo) {
				
				convo.dayStart.startDayDecision = intentConfig.EDIT_TASKS;
				convo.next();
			}
		},
		{
			pattern: utterances.containsEditTaskList,
			callback: function(response, convo) {
				
				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.dayStart.startDayDecision = intentConfig.EDIT_TASKS;
				convo.next();
				
			}
		},
		{
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
 * 		DEPRECATED NOW THAT NO PRIORITIZATION
 * 		~~ if reimplemented will need to re-integrate properly ~~
 */
// user has just entered his tasks for us to display back
function displayTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	var { tasks }                = convo.responses;
	var { prioritizedTaskArray } = convo.dayStart; // this can be filled if user is passing over pending tasks

	var tasks = convo.responses.tasks;
	var taskArray = convertResponseObjectsToTaskArray(tasks);

	// push pending tasks onto user inputed daily tasks
	prioritizedTaskArray.forEach((task) => {
		taskArray.push(task);
	});

	// taskArray is now attached to convo
	convo.dayStart.taskArray = taskArray;

	var options = { dontShowMinutes: true };
	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	// we need to prioritize the task list here to display to user
	convo.say(`Now, please rank your tasks in order of your priorities today`);
	convo.say(taskListMessage);
	convo.ask(`You can just list the numbers, like \`3, 4, 1, 2, 5\``, (response, convo) => {
		prioritizeTaskList(response, convo);
		convo.next();
	}, { 'key' : 'taskPriorities' });
	
}

/**
 * 		DEPRECATED NOW THAT NO PRIORITIZATION
 * 		~~ if reimplemented will need to re-integrate properly ~~
 */
// user has listed `5, 4, 2, 1, 3` for priorities to handle here
function prioritizeTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	// organize the task list!
	var { taskArray } = convo.dayStart;

	// get tasks from array
	var userInput = response.text; // i.e. `1, 3, 4, 2`
	var prioritizedTaskArray = prioritizeTaskArrayFromUserInput(taskArray, userInput)

	// means user input is invalid
	if (!prioritizedTaskArray) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		displayTaskList(response, convo);
		return;
	}

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;
	var options = { dontShowMinutes: true };
	var taskListMessage = convertArrayToTaskListMessage(prioritizedTaskArray, options);

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.say("Excellent! Last thing: how much time would you like to allocate to each task today?");
				convo.say(taskListMessage);
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {

				convo.say("Whoops :banana: Let's try to do this again");
				displayTaskList(response, convo);
				convo.next();

			}
		}
	], { 'key' : 'confirmedRightPriority' });

}