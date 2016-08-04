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

	const { defaultBreakTime, defaultSnoozeTime, doneSessionEarly, sessionTimerUp, currentSession: { dailyTask, workSessionTimeString } } = convo.sessionDone;

	// minutesSpent is updated here, after closing the workSession
	const { minutesSpent, minutes } = dailyTask.dataValues;
	let taskText = dailyTask.Task.text;

	let text;
	let buttonsValuesArray = [];
	let attachmentsConfig  = { defaultBreakTime, defaultSnoozeTime };
	let minutesDifference  = minutes - minutesSpent;
	let timeSpentString    = convertMinutesToHoursString(minutesSpent);

	let finishedTimeToTask = minutesSpent >= minutes ? true: false;

	if (!finishedTimeToTask && doneSessionEarly) {
		convo.say(`Cool, let's end early!`);
	}

	// provide customized attachments based on situation
	if (sessionTimerUp) {

		// triggered by sessionTimerUp
		
		if (finishedTimeToTask) {

			buttonsValuesArray = [
				buttonValues.doneSession.completedPriority.value,
				buttonValues.doneSession.notDone.value,
				buttonValues.doneSession.extendSession.value,
				buttonValues.doneSession.endDay.value
			];

		} else {

			// send message if time is still remaining
			convo.say(`Your session for \`${taskText}\` is up. Excellent work!`);

			buttonsValuesArray = [
				buttonValues.doneSession.takeBreak.value,
				buttonValues.doneSession.extendSession.value,
				buttonValues.doneSession.completedPriorityTonedDown.value,
				buttonValues.doneSession.viewPlan.value,
				buttonValues.doneSession.endDay.value
			];

		}
	} else {

		// triggered by NL "done session"
		
		if (finishedTimeToTask) {
			buttonsValuesArray = [
				buttonValues.doneSession.completedPriority.value,
				buttonValues.doneSession.notDone.value,
				buttonValues.doneSession.endDay.value
			];

			
		} else {

			buttonsValuesArray = [
				buttonValues.doneSession.completedPriority.value,
				buttonValues.doneSession.takeBreak.value,
				buttonValues.doneSession.viewPlan.value,
				buttonValues.doneSession.endDay.value
			];
			
		}
	}

	// text is dependent on whether minutes remaining or not
	if (finishedTimeToTask) {
		text = `Great work! The time you allotted for \`${taskText}\` is up -- you've worked for ${timeSpentString} on this. Would you like to mark it as complete for the day?`;
	} else {
		text = `You've worked for ${workSessionTimeString} on \`${taskText}\` and have ${minutesDifference} minutes remaining`;
	}

	attachmentsConfig.buttonsValuesArray = buttonsValuesArray;
	let attachments = getDoneSessionMessageAttachments(attachmentsConfig);

	convo.ask({
		text,
		attachments
	}, [
		{ // completedPriority
			pattern: utterances.containsCompleteOrCheckOrCross,
			callback: (response, convo) => {
				convo.say("You want to complete your priority!");
				convo.next();
			}
		},
		{ // takeBreak
			pattern: utterances.containsBreak,
			callback: (response, convo) => {
				convo.say("You want to take a break!");
				convo.next();
			}
		},
		{ // extendSession
			pattern: utterances.onlyContainsExtend,
			callback: (response, convo) => {
				convo.say("You want to extend your session!");
				convo.next();
			}
		},
		{ // viewPlan
			pattern: utterances.containsPlan,
			callback: (response, convo) => {
				convo.say("You want to view your plan!");
				convo.next();
			}
		},
		{ // endDay
			pattern: utterances.endDay,
			callback: (response, convo) => {
				convo.say("You want to end your day!");
				convo.next();
			}
		},
		{ // notDone
			pattern: utterances.notDone,
			callback: (response, convo) => {
				convo.say("You aren't done with your priority yet!");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say("Sorry, I didn't get that :thinking_face:");
			}
		}
	]);

}
