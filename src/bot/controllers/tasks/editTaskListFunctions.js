import os from 'os';
import { wit } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues, FINISH_WORD, RESET } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, getUpdateTaskListMessageObject, convertResponseObjectsToTaskArray, convertTimeStringToMinutes } from '../../lib/messageHelpers';

// this one shows the task list message and asks for options
export function startEditTaskListMessage(convo) {

	const { tasksEdit: { dailyTasks, bot } } = convo;

	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	convo.say("Here are your tasks for today :memo::");
	convo.say(taskListMessage);

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
				convo.say("Woo! Let's cross off some tasks :grin:");
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
				convo.say("Let's do it!");
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

function addTasksFlow(response, convo) {

	// tasks is just a copy of dailyTasks (you're saved tasks)
	convo.say(`What tasks would you like to add to your list? Please send me each task in a separate line`);
	convo.say("Then just tell me when you're `done`!");
	askWhichTasksToAdd(response, convo);
	convo.next();

}

function askWhichTasksToAdd(response, convo) {

	var { tasksEdit: { bot, dailyTasks, updateTaskListMessageObject } } = convo;
	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	var tasks = [];
	dailyTasks.forEach((dailyTask) => {
		tasks.push(dailyTask);
	});

	convo.ask({
		text: taskListMessage,
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

				updateTaskListMessageObject = getUpdateTaskListMessageObject(response.channel, bot);
				convo.tasksEdit.updateTaskListMessageObject = updateTaskListMessageObject;

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
					taskListMessage = convertArrayToTaskListMessage(tasks)
					updateTaskListMessageObject.text = taskListMessage;
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
	var options                  = {};

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

function completeTasksFlow(response, convo) {
	convo.say("~~ COMPLETING TASKS ~~");
	convo.next();
}

function deleteTasksFlow(response, convo) {
	convo.say("~~ DELETING TASKS ~~");
	convo.next();
}

function editTaskTimesFlow(response, convo) {
	convo.say("~~ EDITING TIME TO TASKS ~~");
	convo.next();
}
