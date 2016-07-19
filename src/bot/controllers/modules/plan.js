import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput, convertTaskNumberStringToArray, getMostRecentTaskListMessageToUpdate } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';
import { FINISH_WORD, EXIT_EARLY_WORDS, NONE, RESET, colorsHash, buttonValues, taskListMessageDoneButtonAttachment, taskListMessageAddMoreTasksAndResetTimesButtonAttachment, taskListMessageAddMoreTasksButtonAttachment } from '../../lib/constants';
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
				convo.say("I like a fresh start each day, too");
				askForDayTasks(response, convo);
				convo.next();
			}
		},
		{ // user inserts some task numbers
			pattern: utterances.containsNumber,
			callback: function(response, convo) {
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

	const { task }                  = convo;
	const { bot, source_message }   = task;
	var { pendingTasks, taskArray } = convo.dayStart; // ported from beginning of convo flow

	var options = {
		dontShowMinutes: true,
		dontCalculateMinutes: true
	}

	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	var tasks = [];
	taskArray.forEach((task) => {
		tasks.push(task);
	});

	convo.say("Which additional tasks would you like to work on with me today? Please send me each task in a separate line");
	convo.ask({
		text: taskListMessage,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "TASK_LIST_MESSAGE",
				fallback: "Which additional tasks do you want to work on?",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.noAdditionalTasks.name,
							text: "No additional tasks",
							value: buttonValues.noAdditionalTasks.value,
							type: "button"
					}
				]
			}
		]
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
			pattern: FINISH_WORD.reg_exp,
			callback: function(response, convo) {
				convo.say("Excellent!");
				saveTaskResponsesToDayStartObject(tasks, convo);
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{ // this is additional task added in this case.
			default: true,
			callback: function(response, convo) {

				var updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);
				const { text } = response;
				const newTask = {
					text,
					newTask: true
				}

				// should contain none and additional to be
				// NL equivalent to buttonValues.noAdditionalTasks.value
				if (utterances.containsNone.test(response.text) && utterances.containsAdditional.test(response.text)) {
					convo.say("Excellent!");
					getTimeToTasks(response, convo);
					convo.next();
				} else {
					// you can add tasks here then!
					tasks.push(newTask);
					taskListMessage = convertArrayToTaskListMessage(tasks, options)

					updateTaskListMessageObject.text        = taskListMessage;
					updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageDoneButtonAttachment);;

					bot.api.chat.update(updateTaskListMessageObject);
				}
				
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

	convo.ask({
		text: taskListMessage,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "TASK_LIST_MESSAGE",
				fallback: "What tasks do you want to work on?",
				color: colorsHash.grey.hex
			}
		]
	},
	[
		{
			pattern: buttonValues.doneAddingTasks.value,
			callback: function(response, convo) {
				saveTaskResponsesToDayStartObject(tasks, convo);
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: FINISH_WORD.reg_exp,
			callback: (response, convo) => {
				saveTaskResponsesToDayStartObject(tasks, convo);
				convo.say("Excellent!");
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: function(response, convo) {

				var updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);
				const { text } = response;
				const newTask = {
					text,
					newTask: true
				}

				// you can add tasks here then!
				tasks.push(newTask);
				taskListMessage = convertArrayToTaskListMessage(tasks, options)

				updateTaskListMessageObject.text        = taskListMessage;
				updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageDoneButtonAttachment);;
				
				bot.api.chat.update(updateTaskListMessageObject);
				
			}
		}
	]);

}

// ask the question to get time to tasks
function getTimeToTasks(response, convo) {

	var { taskArray, bot } = convo.dayStart;
	var options            = { dontShowMinutes: true };
	var taskListMessage    = convertArrayToTaskListMessage(taskArray, options);

	var timeToTasksArray = [];

	var message = "How much time would you like to allocate to your *first task?* Please enter one by one!";
	convo.ask({
		text: `${message}\n${taskListMessage}`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "TASK_LIST_MESSAGE",
				fallback: "How much time would you like to allocate to your tasks?",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.actuallyWantToAddATask.name,
							text: "Add more tasks!",
							value: buttonValues.actuallyWantToAddATask.value,
							type: "button"
					}
				]
			}
		]
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
					taskListMessage = convertArrayToTaskListMessage(taskArray, { dontShowMinutes: true });

					var message = (timeToTasksArray.length == 0 ? "How much time would you like to allocate to your *first task?* Please enter one by one!" : "How much time would you like to allocate to your *next task?* Please enter one by one!");
					message = `${message}\n${taskListMessage}`;

					updateTaskListMessageObject.text        = message;
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
					taskListMessage = convertArrayToTaskListMessage(taskArray, { dontShowMinutes: true });

					var message = (timeToTasksArray.length == 0 ? "How much time would you like to allocate to your *first task?* Please enter one by one!" : "How much time would you like to allocate to your *next task?* Please enter one by one!");
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

					var taskListMessage = convertArrayToTaskListMessage(taskArray, { dontUseDataValues: true, emphasizeMinutes: true });

					var message = (timeToTasksArray.length == 0 ? "How much time would you like to allocate to your *first task?* Please enter one by one!" : "How much time would you like to allocate to your *next task?* Please enter one by one!");
					message = `${message}\n${taskListMessage}`;

					updateTaskListMessageObject.text        = message;
					updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageAddMoreTasksAndResetTimesButtonAttachment);

					bot.api.chat.update(updateTaskListMessageObject);
				}

				if (timeToTasksArray.length >= taskArray.length) {
					convo.dayStart.taskArray = taskArray;
					consoleLog("finished task array!", taskArray);
					confirmTimeToTasks(timeToTasksArray, convo);
					convo.next();
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
				convo.ask("Ready to start a work session?", [
						{
							pattern: utterances.no,
							callback: (response, convo) => {
								convo.say("Great! Let me know when you're ready to `start a session`");
								convo.next();
							}
						},
						{
							pattern: utterances.yes,
							callback: (response, convo) => {
								convo.dayStart.startDayDecision = intentConfig.START_SESSION;
								convo.next();
							}
						}
					], { 'key' : 'startFirstSession' })
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Let's give this another try :repeat_one:");
				convo.say("Just say time estimates, like `30, 1 hour, or 15 min` and I'll figure it out and assign times to the tasks above in order :smiley:");
				getTimeToTasks(response, convo);
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