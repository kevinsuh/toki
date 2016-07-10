import os from 'os';
import { wit } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues, FINISH_WORD } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, getUpdateTaskListMessageObject } from '../../lib/messageHelpers';

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
				convo.say("Boom! Let's add some tasks :muscle:");
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

	var { tasksEdit: { bot, dailyTasks, updateTaskListMessageObject } } = convo;
	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	var newTasks = [];
	dailyTasks.forEach((dailyTask) => {
		newTasks.push(dailyTask);
	});
	// newTasks is just a copy of dailyTasks (you're saved tasks)
	convo.say(`What tasks would you like to add to your list? Please send me each task in a separate line`);
	convo.say("Then just tell me when you're `done`!");
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
					saveNewTaskResponses(newTasks, convo);
					convo.say("Excellent!");
					convo.next();
				} else {
					newTasks.push(newTask);
					taskListMessage = convertArrayToTaskListMessage(newTasks)
					updateTaskListMessageObject.text = taskListMessage;
					bot.api.chat.update(updateTaskListMessageObject);
				}
			}
		}
	]);

	convo.next();
}

function saveNewTaskResponses(newTasks, convo) {
	convo.say("NEW TASKS!!!");
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