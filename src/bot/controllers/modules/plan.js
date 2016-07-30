import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput, convertTaskNumberStringToArray, getMostRecentTaskListMessageToUpdate, deleteConvoAskMessage, convertResponseObjectToNewTaskArray, getTimeToTaskTextAttachmentWithTaskListMessage, commaSeparateOutTaskArray, getNewPlanAttachments } from '../../lib/messageHelpers';
import { constants, colorsHash, buttonValues, taskListMessageNoButtonsAttachment } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, witDurationToMinutes, mapTimeToTaskArray } from '../../lib/miscHelpers';

/**
 * 		NEW PLAN CONVERSATION FLOW FUNCTIONS
 */

export function startNewPlanFlow(convo) {

	const { task: { bot }, newPlan: { daySplit, autoWizard } } = convo;
	let { newPlan: { prioritizedTasks } }                      = convo;

	let contextDay = "today";
	if (daySplit != constants.MORNING.word) {
		contextDay = `this ${daySplit}`;
	}
	let question = `What are the top 3 most anxious or uncomfortable things you have on your plate ${contextDay}?`
	if (autoWizard) {
		question = `${question} Please enter each one in a separate message!`
	}

	prioritizedTasks = [];
	let options = { dontShowMinutes: true, dontCalculateMinutes: true };
	let taskListMessage;
	convo.ask({
		text: question,
		attachments: getNewPlanAttachments(prioritizedTasks)
	},
	[
		{
			pattern: buttonValues.redoTasks.value,
			callback: function(response, convo) {

				prioritizedTasks = [];

				const updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				updateTaskListMessageObject.text        = question;
				updateTaskListMessageObject.attachments = JSON.stringify(getNewPlanAttachments(prioritizedTasks));
				bot.api.chat.update(updateTaskListMessageObject);

				convo.silentRepeat();

			}
		},
		{
			pattern: utterances.done,
			callback: function(response, convo) {

				convo.newPlan.prioritizedTasks = prioritizedTasks;

				convo.say("Excellent!");

				if (autoWizard) {
					wizardPrioritizeTasks(convo);
				} else {
					prioritizeTasks(convo);
				}

				convo.next();
			}
		},
		{ // this is additional task added in this case.
			default: true,
			callback: function(response, convo) {

				const updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				let newTaskArray = convertResponseObjectToNewTaskArray(response);
				newTaskArray.forEach((newTask) => {
					prioritizedTasks.push(newTask);
				});

				taskListMessage = convertArrayToTaskListMessage(prioritizedTasks, options);

				updateTaskListMessageObject.text = `${question}\n${taskListMessage}`;

				let attachments = getNewPlanAttachments(prioritizedTasks);

				if (prioritizedTasks.length < 3) {
					updateTaskListMessageObject.attachments = JSON.stringify(attachments);
					bot.api.chat.update(updateTaskListMessageObject);
				} else {

					while (prioritizedTasks.length > 3) {
						// only 3 priorities!
						prioritizedTasks.pop();
					}

					// we move on, with default to undo.
					updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageNoButtonsAttachment);
					bot.api.chat.update(updateTaskListMessageObject);

					convo.newPlan.prioritizedTasks = prioritizedTasks;

					convo.say("Excellent!");

					if (autoWizard) {
						wizardPrioritizeTasks(convo);
					} else {
						prioritizeTasks(convo);
					}

					convo.next();

				}
				
			}
		}
	]);

}

function prioritizeTasks(convo) {

}

function wizardPrioritizeTasks(convo) {

	const { task: { bot }, newPlan: { daySplit, autoWizard } } = convo;
	let { newPlan: { prioritizedTasks } }                      = convo;

	if (prioritizedTasks.length == 1) {
		// 1 task needs no prioritizing
		convo.newPlan.startTaskIndex = 0;
		startOnTask(convo);
	} else {
		// 2+ tasks need prioritizing
		let question = `Out of your ${prioritizedTasks.length} priorities, which one would most make the rest of your day easier, or your other tasks more irrelevant?`

		let options         = { dontShowMinutes: true, dontCalculateMinutes: true };
		let taskListMessage = convertArrayToTaskListMessage(prioritizedTasks, options);

		convo.ask(`${question}\n${taskListMessage}`, [
			{
				pattern: utterances.containsNumber,
				callback: (response, convo) => {

					let taskNumbersToWorkOnArray = convertTaskNumberStringToArray(response.text, prioritizedTasks);
					let taskIndexToWorkOn        = taskNumbersToWorkOnArray[0] - 1;

					if (taskIndexToWorkOn) {
						convo.newPlan.startTaskIndex = taskIndexToWorkOn;
						startOnTask(convo);
					} else {
						convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
						convo.repeat();
					}

					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {
					convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
					convo.repeat();
					convo.next();
				}
			}
		]);
	}

}

function startOnTask(convo) {

	const { newPlan: { daySplit, autoWizard, startTaskIndex } } = convo;
	let { newPlan: { prioritizedTasks } }                       = convo;

	let taskString = prioritizedTasks[startTaskIndex].text;

	convo.say(`Great! Let's find time to work on \`${taskString}\``);
	convo.ask("When would you like to start? You can tell me a specific time, like `4pm`, or a relative time, like `in 10 minutes`", (response, convo) => {

		// use wit to decipher the relative time

	});
}

