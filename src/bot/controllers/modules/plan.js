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



}

export function startNewPlanWizardFlow(convo) {

	const { task: { bot }, newPlan: { daySplit } } = convo;
	let { newPlan: { prioritizedTasks } }         = convo;

	let contextDay = "today";
	if (daySplit != constants.MORNING.word) {
		contextDay = `this ${daySplit}`;
	}
	const question = `What are the top 3 most anxious or uncomfortable things you have on your plate ${contextDay}? Please enter each in a separate message!`

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
			pattern: buttonValues.doneAddingTasks.value,
			callback: function(response, convo) {
				convo.next();
			}
		},
		{
			pattern: utterances.done,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say("Excellent!");
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
						prioritizedTasks.pop();
					}

					// we move on, with default to undo.
					updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageNoButtonsAttachment);
					bot.api.chat.update(updateTaskListMessageObject);

					convo.newPlan.prioritizedTasks = prioritizedTasks;

					convo.say("Good to know!");
					convo.next();
					console.log(prioritizedTasks);
				}
				
			}
		}
	]);

}