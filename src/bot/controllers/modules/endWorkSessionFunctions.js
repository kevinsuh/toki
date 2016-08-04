import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, deleteConvoAskMessage, convertMinutesToHoursString, getDoneSessionMessageAttachments } from '../../lib/messageHelpers';
import { dateStringToMomentTimeZone, witTimeResponseToTimeZoneObject, witDurationToMinutes, witDurationToTimeZoneObject} from '../../lib/miscHelpers';

import intentConfig from '../../lib/intents';
import { randomInt, utterances } from '../../lib/botResponses';
import { TOKI_DEFAULT_BREAK_TIME, TOKI_DEFAULT_SNOOZE_TIME, colorsArray, THANK_YOU, buttonValues, colorsHash, endBreakEarlyAttachments, startSessionOptionsAttachments } from '../../lib/constants';

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
				getBreakTime(response, convo)
				convo.next();
			}
		},
		{ // extendSession
			pattern: utterances.containsExtend,
			callback: (response, convo) => {
				getExtendSessionTime(response, convo)
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
				convo.say("What would you like to do?");
				convo.repeat();
				convo.next();
			}
		}
	]);

}

// handle break time
// if button click: default break time
// if NL, default if no duration or datetime suggested
function getBreakTime(response, convo) {

	let { text, intentObject: { entities: { duration, datetime } } } = response;
	const { sessionDone: { tz, defaultBreakTime, UserId } } = convo;
	let now = moment();

	let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
	if (!customTimeObject) {

		// use default break time if it doesn't exist!
		if (!defaultBreakTime && UserId) {
			convo.say(`I recommend taking a break after working in a focused session -- it helps you stay fresh and focus even better when you jump back into your work`);
			convo.say(`The default break time is *${TOKI_DEFAULT_BREAK_TIME} minutes*, but you can change it in your settings by telling me to \`show settings\`, or you can set a custom break time after any session by saying \`break for 20 minutes\`, or something like that :grinning:`);
			// first time not updating at convo end...
			models.User.update({
				defaultBreakTime: TOKI_DEFAULT_BREAK_TIME
			}, {
				where: [`"Users"."id" = ?`, UserId]
			});
		}

		customTimeObject = moment().tz(tz).add(TOKI_DEFAULT_BREAK_TIME, 'minutes');

	}

	let customTimeString = customTimeObject.format("h:mm a");
	let durationMinutes  = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

	if (!defaultBreakTime && UserId) {
		convo.say(`I set your default break time to ${durationMinutes} minutes and will check with you then`);
	}
	
	// push the reminder
	convo.sessionDone.reminders.push({
		customNote: `It's been ${durationMinutes} minutes. Let me know when you're ready to start a session`,
		remindTime: customTimeObject,
		type: "break"
	});

	/**
	 * 	MAIN BREAK MESSAGE
	 */
	convo.say({
		text: `See you in ${durationMinutes} minutes -- I'll let you know when your break is over :palm_tree:`,
		attachments: endBreakEarlyAttachments
	});

	convo.next();

}

// handle break time
// if button click: default break time
// if NL, default if no duration or datetime suggested
function getExtendSessionTime(response, convo) {

	let { text, intentObject: { entities: { duration, datetime } } } = response;
	const { sessionDone: { tz, defaultSnoozeTime, UserId, currentSession: { dailyTask } } } = convo;
	let now = moment();

	let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
	if (!customTimeObject) {

		// use default break time if it doesn't exist!
		if (!defaultSnoozeTime && UserId) {
			convo.say(`Sure thing! Extend Session is all about keeping you in the flow (for future sessions :grin:)`);
			convo.say(`You can either hit the Extend Session button, which defaults to *${TOKI_DEFAULT_SNOOZE_TIME}* minutes, or let me know how long you want to extend by saying \`extend by 30 minutes\` or \`extend until 1pm\` to keep your current session rolling`);
			convo.say(`It’s good to take breaks after focusing for long periods of time, but I want to help you facilitate flow and get out of your way when you’re feeling it :raised_hands:`);
			// first time not updating at convo end...
			models.User.update({
				defaultSnoozeTime: TOKI_DEFAULT_SNOOZE_TIME
			}, {
				where: [`"Users"."id" = ?`, UserId]
			});
		}

		customTimeObject = moment().tz(tz).add(defaultSnoozeTime, 'minutes');

	}

	let customTimeString = customTimeObject.format("h:mm a");
	let durationMinutes  = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

	// the extend session time object
	convo.sessionDone.extendSession = customTimeObject;

	if (!defaultSnoozeTime && UserId) {
		convo.say({
			text: `I’ll see you at *${customTimeString}*! :clock1230: _P.S. you can change your default extend by saying \`show settings\`)_`,
			attachments: startSessionOptionsAttachments
		});
	} else {
		/**
		 * 	MAIN EXREND SESSION MESSAGE
		 */
		let taskText = dailyTask.Task.text;
		convo.say({
			text: `You're unstoppable! Keep cranking on \`${taskText}\` :wrench: and I'll see you in ${durationMinutes} minutes at *${customTimeString}*`,
			attachments: startSessionOptionsAttachments
		});
	}

	convo.next();

}
