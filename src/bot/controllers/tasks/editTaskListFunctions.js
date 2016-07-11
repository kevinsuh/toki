import os from 'os';
import { wit } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues, FINISH_WORD, RESET } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, getUpdateTaskListMessageObject, convertResponseObjectsToTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, getMostRecentTaskListMessageToUpdate } from '../../lib/messageHelpers';

// this one shows the task list message and asks for options
export function startEditTaskListMessage(convo) {

	const { tasksEdit: { dailyTasks, bot } } = convo;

	var options = { segmentCompleted: true }
	var taskListMessage = convertArrayToTaskListMessage(dailyTasks, options);

	convo.say("Here are your tasks for today :memo::");
	convo.say({
		text: taskListMessage,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "TASK_LIST_MESSAGE",
				fallback: "Here's your task list!"
			}
		]
	})

	askForTaskListOptions(convo);
	convo.next();
}

function askForTaskListOptions(convo) {

	convo.ask({
		text: `What would you like to do?`,
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
				completeTasksFlow(response, convo);
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
				deleteTasksFlow(response, convo);
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
				convo.say("Let's do this :hourglass:");
				editTaskTimesFlow(response, convo);
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
				convo.say("Okay! Keep at it :smile_cat:");
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
 * 			~~ ADD TASKS FLOW ~~
 */

function addTasksFlow(response, convo) {

	// tasks is just a copy of dailyTasks (you're saved tasks)
	convo.say(`What tasks would you like to add to your list? Please send me each task in a separate line`);
	askWhichTasksToAdd(response, convo);
	convo.next();

}

function askWhichTasksToAdd(response, convo) {

	var { tasksEdit: { bot, dailyTasks } } = convo;
	var updateTaskListMessageObject        = getMostRecentTaskListMessageToUpdate(response.channel, bot);

	var tasks = [];

	convo.ask({
		text: "Then just tell me when you're `done`!",
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "ADD_TASKS",
				fallback: "What tasks do you want to add?",
			}
		]
	},
	[
		{ // this is failure point. restart with question
			default: true,
			callback: function(response, convo) {

				const { text } = response;
				const newTask = {
					text,
					newTask: true
				}

				// everything except done!
				if (FINISH_WORD.reg_exp.test(response.text)) {
					saveNewTaskResponses(tasks, convo);
					convo.say("Excellent!");
					getTimeToNewTasks(response, convo);
					convo.next();
				} else {

					tasks.push(newTask);
					var options = { segmentCompleted: true, newTasks: tasks };
					var fullTaskListMessage = convertArrayToTaskListMessage(dailyTasks, options)

					updateTaskListMessageObject.text = fullTaskListMessage;
					bot.api.chat.update(updateTaskListMessageObject);

				}
			}
		}
	]);
}

function saveNewTaskResponses(tasks, convo) {

	// get the newTasks!
	var { dailyTasks } = convo.tasksEdit;

	if (tasks) {

		// only get the new tasks
		var newTasks = [];
		tasks.forEach((task) => {
			if (task.newTask) {
				newTasks.push(task);
			}
		})
		var newTasksArray = convertResponseObjectsToTaskArray(newTasks);
		if (!dailyTasks) {
			dailyTasks = [];
		}

		convo.tasksEdit.dailyTasks = dailyTasks; // all daily tasks
		convo.tasksEdit.newTasks   = newTasksArray; // only the new ones

	}

	convo.next();
}

function getTimeToNewTasks(response, convo) {

	var { bot, dailyTasks, newTasks } = convo.tasksEdit;
	var options                    = { dontShowMinutes: true };
	var taskListMessage            = convertArrayToTaskListMessage(newTasks, options);

	convo.say("How much time would you like to allocate to your new tasks?");

	var timeToTasksArray = [];
	convo.ask({
		text: taskListMessage,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "ADD_TIME_TO_NEW_TASKS",
				fallback: "What are the times to your new tasks?",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.actuallyWantToAddATask.name,
							text: "Add more tasks!",
							value: buttonValues.actuallyWantToAddATask.value,
							type: "button"
					},
					{
							name: buttonValues.resetTimes.name,
							text: "Reset times",
							value: buttonValues.resetTimes.value,
							type: "button",
							style: "danger"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.actuallyWantToAddATask.value,
			callback: function(response, convo) {
				askWhichTasksToAdd(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.resetTimes.value,
			callback: (response, convo) => {

				var updateTaskListMessageObject = getUpdateTaskListMessageObject(response.channel, bot);
				if (updateTaskListMessageObject) {
					convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
					// reset ze task list message
					timeToTasksArray = [];
					taskListMessage = convertArrayToTaskListMessage(newTasks, { dontShowMinutes: true });
					updateTaskListMessageObject.text = taskListMessage;
					bot.api.chat.update(updateTaskListMessageObject);
				}

				convo.silentRepeat();
			}
		},
		{
			pattern: RESET.reg_exp,
			callback: (response, convo) => {

				var updateTaskListMessageObject = getUpdateTaskListMessageObject(response.channel, bot);
				if (updateTaskListMessageObject) {
					convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
					// reset ze task list message
					timeToTasksArray = [];
					taskListMessage = convertArrayToTaskListMessage(newTasks, { dontShowMinutes: true });
					updateTaskListMessageObject.text = taskListMessage;
					bot.api.chat.update(updateTaskListMessageObject);
				}

				convo.silentRepeat();

			}
		},
		{
			default: true,
			callback: function(response, convo) {

				var updateTaskListMessageObject = getUpdateTaskListMessageObject(response.channel, bot);

				if (updateTaskListMessageObject) {
					convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;
					const comma            = new RegExp(/[,]/);
					var validMinutesTester = new RegExp(/[\dh]/);
					var timeToTasks        = response.text.split(comma);

					timeToTasks.forEach((time) => {
						if (validMinutesTester.test(time)) {
							var minutes = convertTimeStringToMinutes(time);
							timeToTasksArray.push(minutes);
						}
					});

					newTasks = newTasks.map((task, index) => {
						if (task.dataValues) { // task from DB
							return {
								...task,
								minutes: timeToTasksArray[index],
								text: task.dataValues.text
							}
						}
						return { // newly created task
							...task,
							minutes: timeToTasksArray[index]
						}
					});

					var taskListMessage = convertArrayToTaskListMessage(newTasks, { dontUseDataValues: true, emphasizeMinutes: true });

					updateTaskListMessageObject.text = taskListMessage;
					bot.api.chat.update(updateTaskListMessageObject);
				}

				if (timeToTasksArray.length >= newTasks.length) {
					convo.tasksEdit.newTasks = newTasks;
					confirmTimeToTasks(response, convo);
					convo.next();
				}

			}
		}
	]);

}

function confirmTimeToTasks(response, convo) {

	convo.ask("Are those times right?", [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				addNewTasksToTaskList(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Let's give this another try :repeat_one:");
				convo.say("Just say time estimates, like `30, 1 hour, or 15 min` and I'll figure it out and assign times to the tasks above in order :smiley:");
				getTimeToNewTasks(response, convo);
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

	convo.say("This looks great! Here's your updated task list :memo::");
	convo.say(taskListMessage);
	convo.next();

}

/**
 * 			~~ COMPLETE TASKS FLOW ~~
 */

function completeTasksFlow(response, convo) {

	var { tasksEdit: { dailyTasks } } = convo;
	var message = `Which of your task(s) above would you like to complete?`;

	convo.ask(message, [
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay, let me know if you still want to `edit tasks`");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				confirmCompleteTasks(response, convo);
				convo.next();
			}
		}
	]);

	convo.next();
}

function confirmCompleteTasks(response, convo) {

	var tasksToCompleteString = response.text;
	var { dailyTasks, dailyTaskIdsToComplete } = convo.tasksEdit;

	// if we capture 0 valid tasks from string, then we start over
	var taskNumbersToCompleteArray = convertTaskNumberStringToArray(tasksToCompleteString, dailyTasks);
	if (!taskNumbersToCompleteArray) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("Please pick tasks from your list like `tasks 1, 3 and 4` or say `never mind`");
		var taskListMessage = convertArrayToTaskListMessage(dailyTasks);
		convo.say(taskListMessage);
		completeTasksFlow(response, convo);
		return;
	}

	var dailyTasksToComplete = [];
	dailyTasks.forEach((dailyTask, index) => {
		var taskNumber = index + 1; // b/c index is 0-based
		if (taskNumbersToCompleteArray.indexOf(taskNumber) > -1) {
			dailyTasksToComplete.push(dailyTask);
		}
	});

	var dailyTaskTextsToComplete = dailyTasksToComplete.map((dailyTask) => {
		return dailyTask.dataValues.Task.text;
	})

	var taskListMessage = commaSeparateOutTaskArray(dailyTaskTextsToComplete);

	convo.ask(`So you would like to complete ${taskListMessage}?`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.say("Sounds great, checked off :white_check_mark:!");

				// add to delete array for tasksEdit
				dailyTaskIdsToComplete = dailyTasksToComplete.map((dailyTask) => {
					return dailyTask.dataValues.id;
				})
				convo.tasksEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;

				updateCompleteTaskListMessage(response, convo);
				convo.next();

			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay, let me know if you still want to `edit tasks`");
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

function updateCompleteTaskListMessage(response, convo) {

	var { tasksEdit: { bot, dailyTasks, dailyTaskIdsToComplete } } = convo;
	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	// spit back updated task list
	var taskArray = [];
	var fullTaskArray = []; // this one will have all daily tasks but with ~completed~ updated
	dailyTasks.forEach((dailyTask, index) => {
		const { dataValues: { id } } = dailyTask;
		if (dailyTaskIdsToComplete.indexOf(id) < 0) {
			// daily task is NOT in the ids to delete
			taskArray.push(dailyTask);
		} else {
			dailyTask.dataValues.done = true; // semi hack
		}
		fullTaskArray.push(dailyTask);
	});

	var taskListMessage     = convertArrayToTaskListMessage(taskArray);
	var fullTaskListMessage = convertArrayToTaskListMessage(fullTaskArray);

	var updateTaskListMessageObject  = getMostRecentTaskListMessageToUpdate(response.channel, bot);
	updateTaskListMessageObject.text = fullTaskListMessage;
	bot.api.chat.update(updateTaskListMessageObject);

	convo.say("Here's the rest of your task list for today :memo::");
	convo.say(taskListMessage);

	// should ask if ready for session

	convo.next();

}

/**
 * 			~~ DELETE TASKS FLOW ~~
 */

function deleteTasksFlow(response, convo) {

	var { tasksEdit: { dailyTasks } } = convo;
	var message = `Which of your task(s) above would you like to delete?`;

	convo.ask(message, [
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay, let me know if you still want to `edit tasks`");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				confirmDeleteTasks(response, convo);
				convo.next();
			}
		}
	]);

	convo.next();
}

function confirmDeleteTasks(response, convo) {

	var tasksToDeleteString = response.text;
	var { dailyTasks, dailyTaskIdsToDelete } = convo.tasksEdit;

	// if we capture 0 valid tasks from string, then we start over
	var taskNumbersToDeleteArray = convertTaskNumberStringToArray(tasksToDeleteString, dailyTasks);
	if (!taskNumbersToDeleteArray) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("Please pick tasks from your list like `tasks 1, 3 and 4` or say `never mind`");
		var taskListMessage = convertArrayToTaskListMessage(dailyTasks);
		convo.say(taskListMessage);
		deleteTasksFlow(response, convo);
		return;
	}

	var dailyTasksToDelete = [];
	dailyTasks.forEach((dailyTask, index) => {
		var taskNumber = index + 1; // b/c index is 0-based
		if (taskNumbersToDeleteArray.indexOf(taskNumber) > -1) {
			dailyTasksToDelete.push(dailyTask);
		}
	});

	var dailyTaskTextsToDelete = dailyTasksToDelete.map((dailyTask) => {
		return dailyTask.dataValues.Task.text;
	})

	var taskListMessage = commaSeparateOutTaskArray(dailyTaskTextsToDelete);

	convo.ask(`So you would like to delete ${taskListMessage}?`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.say("Sounds great, deleted!");

				// add to delete array for tasksEdit
				dailyTaskIdsToDelete = dailyTasksToDelete.map((dailyTask) => {
					return dailyTask.dataValues.id;
				})
				convo.tasksEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;

				// spit back updated task list
				var taskArray = [];
				dailyTasks.forEach((dailyTask, index) => {
					const { dataValues: { id } } = dailyTask;
					if (dailyTaskIdsToDelete.indexOf(id) < 0) {
						// daily task is NOT in the ids to delete
						taskArray.push(dailyTask);
					}
				});

				var taskListMessage = convertArrayToTaskListMessage(taskArray);

				convo.say("Here's your updated task list :memo::");
				convo.say(taskListMessage);

				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay, let me know if you still want to `edit tasks`");
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

/**
 * 			~~ EDIT TIMES TO TASKS FLOW ~~
 */

function editTaskTimesFlow(response, convo) {
	convo.say("~~ EDITING TIME TO TASKS ~~");
	convo.next();
}
