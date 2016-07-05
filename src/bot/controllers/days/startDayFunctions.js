import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';
import { FINISH_WORD, EXIT_EARLY_WORDS, NONE, colorsHash, buttonValues } from '../../lib/constants';

/**
 * 		START DAY CONVERSATION FLOW FUNCTIONS
 */


// show user previous pending tasks to decide on them
export function showPendingTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	var { pendingTasks }          = convo.dayStart;

	var options = {
		dontShowMinutes: true
	}
	var taskListMessage = convertArrayToTaskListMessage(pendingTasks, options);
	convo.say("Which of these outstanding tasks would you still like to work on? Just tell me the numbers :1234:");
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
							name: buttonValues.noPendingTasks.name,
							text: "None of these",
							value: buttonValues.noPendingTasks.value,
							type: "button"
					}
				]
			}
		]
	},
	[
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
				convo.say("I like a fresh start each day, too :tangerine:");
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
	var userInput = response.text; // i.e. `1, 3, 4, 2`
	var taskArray = prioritizeTaskArrayFromUserInput(pendingTasks, userInput)

	// means user input is invalid
	if (!taskArray) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		showPendingTasks(response, convo);
		return;
	} else {
		// save this to keep moving on!
		convo.dayStart.taskArray = taskArray;
	}

	var options = {
		dontShowMinutes: true
	}
	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	var tasks = [];
	convo.say("This is starting to look good :sunglasses:");
	convo.say("Which additional tasks would you like to work on with me today?");
	convo.say("You can enter everything in one line, separated by commas, or send me each task in a separate line");
	convo.ask({
		text: "Then just tell me when you're `done`!",
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "NEW_TASKS",
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
		{ // NL equivalent to buttonValues.noAdditionalTasks.value
			pattern: utterances.containsNone,
			callback: function(response, convo) {
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{ // this is additional task added in this case.
			default: true,
			callback: function(response, convo) {
				tasks.push(response);
				if (FINISH_WORD.reg_exp.test(response.text)) {
					saveTaskResponsesToDayStartObject(tasks, convo);
					getTimeToTasks(response, convo);
					convo.next();
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
		var newTasksArray = convertResponseObjectsToTaskArray(tasks);
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
	convo.say(`What tasks would you like to work on today? :pencil:`);
	convo.ask(`Please enter all of the tasks in one line, separated by commas, or just send me each task in a separate line. Then just tell me when you're done by saying \`${FINISH_WORD.word}\``, (response, convo) => {

		for (var i = 0; i < EXIT_EARLY_WORDS.length; i++) {
			if (response.text == EXIT_EARLY_WORDS[i])
				convo.stop();
		}

		tasks.push(response);
		if (FINISH_WORD.reg_exp.test(response.text)) {
			saveTaskResponsesToDayStartObject(tasks, convo);
			getTimeToTasks(response, convo);
			convo.next();
		}
	});

}

// if user wants to add more tasks
function addMoreTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	convo.say("Of course - just add another task here and say `done` when you're ready to go");
	var { taskArray }   = convo.dayStart;
	var options         = { dontShowMinutes: true };
	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	var tasks = [];
	convo.ask(taskListMessage, (response, convo) => {

		tasks.push(response);

		if (FINISH_WORD.reg_exp.test(response.text)) {
			saveTaskResponsesToDayStartObject(tasks, convo);
			getTimeToTasks(response, convo);
			convo.next();
		}
	});

}

// ask the question to get time to tasks
function getTimeToTasks(response, convo) {

	var { taskArray }   = convo.dayStart;
	var options         = { dontShowMinutes: true };
	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	convo.say("Excellent! How much time would you like to allocate to each task?");
	convo.ask({
		text: taskListMessage,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "TIME_TO_TASKS",
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
			default: true,
			callback: function(response, convo) {
				if (utterances.containsAdd.test(response.text) && utterances.containsTask.test(response.text)) {
					// NL equivalent to buttonValues.actuallyWantToAddATask.value
					addMoreTasks(response, convo);
				} else if (FINISH_WORD.reg_exp.test(response.text)) {
					// user is ready to move on w/ conversation
					saveTaskResponsesToTasksObject(convo);
					getTimeToTasks(response, convo);
				}
				convo.next();
			}
		}
	]);

}

// this is the work we do to actually assign time to tasks
function assignTimeToTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	var { prioritizedTaskArray }  = convo.dayStart;

	var timeToTask = response.text;

	// need to check for invalid responses.
	// does not say minutes or hours, or is not right length
	var isInvalid = false;
	timeToTask = timeToTask.split(",");
	if (timeToTask.length != prioritizedTaskArray.length) {
		isInvalid = true;
	};

	var validMinutesTester = new RegExp(/[\dh]/);
	timeToTask = timeToTask.map((time) => {
		if (!validMinutesTester.test(time)) {
			isInvalid = true;
		}
		var minutes = convertTimeStringToMinutes(time);
		return minutes;
	});

	prioritizedTaskArray = prioritizedTaskArray.map((task, index) => {
		if (task.dataValues) {
			return {
				...task,
				minutes: timeToTask[index],
				text: task.dataValues.text
			}
		}
		return {
			...task,
			minutes: timeToTask[index]
		}
	});

	console.log("\n\n ~~ time to tasks ~~ \n\n");

	var options = {
		dontUseDataValues: true
	}

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;
	var taskListMessage = convertArrayToTaskListMessage(prioritizedTaskArray, options);

	// INVALID tester
	if (isInvalid) {
		convo.say("Oops, looks like you didn't put in valid times :thinking_face:. Let's try this again");
		convo.say("Send me the amount of time you'd like to work on each task above, separated by commas. The first time you list will represent the first task above, the second time you list will represent the second task, and on and on");
		convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `2 hours`");
		convo.say(taskListMessage);
		getTimeToTasks(response, convo);
		return;
	}

	convo.say("Are these times right?");
	convo.ask(taskListMessage, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.say("Boom! This looks great");
				convo.ask("Ready to start your first focused work session today?", [
						{
							pattern: utterances.yes,
							callback: (response, convo) => {
								convo.dayStart.startDayDecision = intentConfig.START_SESSION;
								convo.next();
							}
						},
						{
							pattern: utterances.no,
							callback: (response, convo) => {
								convo.say("Great! Let me know when you're ready to start");
								convo.say("Alternatively, you can ask me to `remind` you to start at a specific time, like `remind me to start at 10am` or a relative time like `remind me in 10 minutes`");
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
				convo.say("Send me the amount of time you'd like to work on each task above, separated by commas. The first time you list will represent the first task above, the second time you list will represent the second task, and on and on");
				convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `2 hours`");
				convo.ask(taskListMessage, (response, convo) => {
					assignTimeToTasks(response, convo);
					convo.next();
				})
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