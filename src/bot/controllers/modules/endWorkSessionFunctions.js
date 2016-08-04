import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, deleteConvoAskMessage, convertMinutesToHoursString, getDoneSessionMessageAttachments } from '../../lib/messageHelpers';
import { dateStringToMomentTimeZone, witTimeResponseToTimeZoneObject, witDurationToMinutes, witDurationToTimeZoneObject} from '../../lib/miscHelpers';

import intentConfig from '../../lib/intents';
import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash } from '../../lib/constants';

/**
 * 		END WORK SESSION CONVERSATION FLOW FUNCTIONS
 */
export function doneSessionAskOptions(convo) {

	const { defaultBreakTime, doneSessionEarly, sessionTimerUp, currentSession: { dailyTask, workSessionTimeString } } = convo.sessionDone;

	// minutesSpent is updated here, after closing the workSession
	const { minutesSpent, minutes } = dailyTask.dataValues;
	let taskText = dailyTask.Task.text;

	let text;
	let buttonsValuesArray = [];
	let attachmentsConfig  = { defaultBreakTime };
	let minutesDifference  = minutes - minutesSpent;
	let timeSpentString    = convertMinutesToHoursString(minutesSpent);

	let finishedTimeToTask = minutesSpent >= minutes ? true: false;

	if (!finishedTimeToTask && doneSessionEarly) {
		convo.say(`Cool, let's end early!`);
	}

	if (sessionTimerUp) {
		buttonsValuesArray = [
			buttonValues.doneSession.takeBreak.value,
			buttonValues.doneSession.extendSession.value,
			buttonValues.doneSession.viewPlan.value,
			buttonValues.doneSession.endDay.value
		];
		// triggered by sessionTimerUp
		if (finishedTimeToTask) {

		} else {

		}
	} else {
		// NL "done session"
		if (finishedTimeToTask) {
			buttonsValuesArray = [
				buttonValues.doneSession.completedPriority.value,
				buttonValues.doneSession.notDone.value,
				buttonValues.doneSession.endDay.value
			];

			text = `Great work! The time you allotted for \`${taskText}\` is up -- you've worked for ${timeSpentString} on this. Would you like to mark it as complete for the day?`;
		} else {
			buttonsValuesArray = [
				buttonValues.doneSession.completedPriority.value,
				buttonValues.doneSession.takeBreak.value,
				buttonValues.doneSession.viewPlan.value,
				buttonValues.doneSession.endDay.value
			];
				
			text = `You've worked for ${workSessionTimeString} on \`${taskText}\` and have ${minutesDifference} minutes remaining`;
		}
	}

	attachmentsConfig.buttonsValuesArray = buttonsValuesArray;
	let attachments = getDoneSessionMessageAttachments(attachmentsConfig);

	convo.ask({
		text,
		attachments
	}, [
		{
			pattern: utterances.containsBreak,
			callback: (response, convo) => {

			}
		},
		{
			pattern: utterances.containsBreak,
			callback: (response, convo) => {

			}
		},
		{
			pattern: utterances.containsBreak,
			callback: (response, convo) => {

			}
		},
		{
			pattern: utterances.containsBreak,
			callback: (response, convo) => {

			}
		},
		{
			pattern: utterances.containsBreak,
			callback: (response, convo) => {

			}
		},
		{
			pattern: utterances.containsBreak,
			callback: (response, convo) => {

			}
		},
		{
			pattern: utterances.containsBreak,
			callback: (response, convo) => {

			}
		}
	]);

}
