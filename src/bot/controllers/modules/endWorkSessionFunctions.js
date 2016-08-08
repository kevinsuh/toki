import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, deleteConvoAskMessage, convertMinutesToHoursString, getDoneSessionMessageAttachments } from '../../lib/messageHelpers';
import { dateStringToMomentTimeZone, witTimeResponseToTimeZoneObject, witDurationToMinutes, witDurationToTimeZoneObject} from '../../lib/miscHelpers';

import { randomInt, utterances } from '../../lib/botResponses';
import { TOKI_DEFAULT_BREAK_TIME, TOKI_DEFAULT_SNOOZE_TIME, colorsArray, THANK_YOU, buttonValues, colorsHash, endBreakEarlyAttachments, startSessionOptionsAttachments, intentConfig } from '../../lib/constants';

/**
 * 		END WORK SESSION CONVERSATION FLOW FUNCTIONS
 */
export function doneSessionAskOptions(convo) {

	const { defaultBreakTime, defaultSnoozeTime, doneSessionEarly, sessionTimerUp, currentSession: { dailyTask, workSessionTimeString } } = convo.sessionDone;

	// minutesSpent is updated here, after closing the workSession
	const { minutesSpent, minutes } = dailyTask.dataValues;
	let taskText = dailyTask.Task.text;

	let text;
	let buttonsValuesArray     = [];
	let minutesDifference      = minutes - minutesSpent;
	let timeSpentString        = convertMinutesToHoursString(minutesSpent);
	let minutesRemainingString = convertMinutesToHoursString(minutesDifference);

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
				buttonValues.doneSession.didSomethingElse.value
			];

		} else {

			// send message if time is still remaining
			convo.say(`Your session for \`${taskText}\` is up. Excellent work!`);

			buttonsValuesArray = [
				buttonValues.doneSession.takeBreak.value,
				buttonValues.doneSession.extendSession.value,
				buttonValues.doneSession.completedPriorityTonedDown.value,
				buttonValues.doneSession.didSomethingElse.value,
				buttonValues.doneSession.beBackLater.value
			];

		}
	} else {

		// triggered by NL "done session"
		
		if (finishedTimeToTask) {
			buttonsValuesArray = [
				buttonValues.doneSession.completedPriority.value,
				buttonValues.doneSession.notDone.value,
				buttonValues.doneSession.didSomethingElse.value
			];

			
		} else {

			buttonsValuesArray = [
				buttonValues.doneSession.takeBreak.value,
				buttonValues.doneSession.completedPriorityTonedDown.value,
				buttonValues.doneSession.didSomethingElse.value,
				buttonValues.doneSession.viewPlan.value,
				buttonValues.doneSession.beBackLater.value
			];
			
		}
	}

	// text is dependent on whether minutes remaining or not
	if (finishedTimeToTask) {
		text = `Great work! The time you allotted for \`${taskText}\` is up -- you've worked for ${timeSpentString} on this. Would you like to mark it as complete for the day?`;
	} else {
		text = `You've worked for ${workSessionTimeString} on \`${taskText}\` and have ${minutesRemainingString} remaining`;
	}

	// if minutes is NULL, then we will have custom question
	if (!minutes) {
		text = `You've worked for ${workSessionTimeString} on \`${taskText}\`. Did you complete this priority?`;
	}

	let attachmentsConfig  = { defaultBreakTime, defaultSnoozeTime, buttonsValuesArray };
	let attachments = getDoneSessionMessageAttachments(attachmentsConfig);
	convoAskDoneSessionOptions(convo, text, attachments);

}

function completePriorityForSession(convo) {

	let { sessionDone: { tz, dailyTasks, defaultBreakTime, UserId, currentSession: { dailyTask } } } = convo;

	convo.sessionDone.priorityDecision.completeDailyTask = true;

	let unCompletedDailyTasks = dailyTasks.filter((currentDailyTask) => {
		if (currentDailyTask.dataValues && (currentDailyTask.dataValues.id != dailyTask.dataValues.id)) {
			return true;
		}
	});

	let dailyTaskTexts = unCompletedDailyTasks.map((dailyTask) => {
		return dailyTask.dataValues.Task.text;
	})

	let config = { codeBlock: true }
	let tasksString = commaSeparateOutTaskArray(dailyTaskTexts, config);

	convo.say(`Let’s go! You’re one step closer to winning the day! You have ${tasksString} remaining`);

	let buttonsValuesArray = [
		buttonValues.doneSession.takeBreak.value,
		buttonValues.doneSession.newSession.value,
		buttonValues.doneSession.viewPlan.value,
		buttonValues.doneSession.beBackLater.value
	];

	let attachmentsConfig = { defaultBreakTime, buttonsValuesArray };
	let attachments       = getDoneSessionMessageAttachments(attachmentsConfig);

	let text = `Let’s take a well-deserved break and get after it when you return`;

	convoAskDoneSessionOptions(convo, text, attachments);

	convo.next();

}

// this will actually ask the convo options in a modular, DRY way
function convoAskDoneSessionOptions(convo, text, attachments) {

	convo.ask({
		text,
		attachments
	}, [
		{ // completedPriority
			pattern: utterances.containsCompleteOrCheckOrCross,
			callback: (response, convo) => {
				completePriorityForSession(convo);
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
		{ // newSession
			pattern: utterances.containsNew,
			callback: (response, convo) => {
				convo.say(`Alright, you're crushing it.`);
				convo.sessionDone.postSessionDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{ // viewPlan
			pattern: utterances.containsPlan,
			callback: (response, convo) => {
				convo.say(`Got it`);
				convo.sessionDone.postSessionDecision = intentConfig.VIEW_PLAN;
				convo.next();
			}
		},
		{ // endDay
			pattern: utterances.endDay,
			callback: (response, convo) => {
				convo.sessionDone.postSessionDecision = intentConfig.END_PLAN;
				convo.next();
			}
		},
		{ // notDone
			pattern: utterances.notDone,
			callback: (response, convo) => {
				askForAdditionalTimeToPriority(response, convo);
				convo.next();
			}
		},
		{ // spentTimeOnSomethingElse
			pattern: utterances.somethingElse,
			callback: (response, convo) => {
				switchWorkedOnPriority(convo);
				convo.next();
			}
		},
		{ // spentTimeOnSomethingElse
			pattern: utterances.containsBackLater,
			callback: (response, convo) => {
				convo.say(`Okay! I'll be here when you want to make progress with a \`new session\` :muscle:`);
				convo.next();
			}
		},
		{
			// no or never mind to exit this flow
			pattern: utterances.containsNoOrNeverMindOrNothing,
			callback: (response, convo) => {
				convo.say(`Okay! I'll be here when you want to make progress with a \`new session\` :muscle:`);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				text = "Sorry, I didn't get that :thinking_face:. What would you like to do?";
				attachments = []
				convoAskDoneSessionOptions(convo, text, attachments);
				convo.next();
			}
		}
	]);

}

function askForAdditionalTimeToPriority(response, convo) {

	let { intentObject: { entities: { duration, datetime } } } = response;
	const { sessionDone: { tz, dailyTasks, defaultSnoozeTime, defaultBreakTime, UserId, currentSession: { dailyTask } } } = convo;

	const { minutesSpent } = dailyTask.dataValues;
	let taskText = dailyTask.Task.text;

	let text = `Got it - let's adjust your plan accordingly. *How much additional time* \`i.e. 1 more hour\` would you like to allocate to \`${taskText}\` for the rest of today?`;
	let buttonsValuesArray = [
		buttonValues.doneSession.didSomethingElse.value,
		buttonValues.doneSession.moveOn.value
	];
	let attachmentsConfig  = { buttonsValuesArray };
	let attachments = getDoneSessionMessageAttachments(attachmentsConfig);
	convo.ask({
		text,
		attachments
	}, [
		{ // spentTimeOnSomethingElse
			pattern: utterances.somethingElse,
			callback: (response, convo) => {

				let taskListMessage = convertArrayToTaskListMessage(dailyTasks);
				convo.say(taskListMessage);
				askToReplacePriority(convo);
				convo.next();
			}
		},
		{ // moveOn
			pattern: utterances.moveOn,
			callback: (response, convo) => {
				let timeSpentString = convertMinutesToHoursString(minutesSpent);

				let buttonsValuesArray = [
					buttonValues.doneSession.takeBreak.value,
					buttonValues.doneSession.newSession.value,
					buttonValues.doneSession.viewPlan.value,
					buttonValues.doneSession.beBackLater.value
				];

				let attachmentsConfig = { defaultBreakTime, buttonsValuesArray };
				let attachments       = getDoneSessionMessageAttachments(attachmentsConfig);
				let text              = `Kudos! You spent ${timeSpentString} on \`${taskText}\` today. Let’s take a break and queue up your next priority when you get back`;
				convoAskDoneSessionOptions(convo, text, attachments);
				
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// default will be time. if no customTimeObject, repeat question
				let { text, intentObject: { entities: { duration, datetime } } } = response;
				let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
				let now = moment();

				if (!customTimeObject) {
					convo.say("Sorry, I didn't get that :thinking_face:");
					convo.repeat();
				} else {

					// success and user wants additional time to priority!

					let durationMinutes  = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
					convo.sessionDone.currentSession.additionalMinutes = durationMinutes;

					let buttonsValuesArray = [
						buttonValues.doneSession.takeBreak.value,
						buttonValues.doneSession.newSession.value,
						buttonValues.doneSession.viewPlan.value,
						buttonValues.doneSession.beBackLater.value
					];

					let attachmentsConfig  = { defaultBreakTime, buttonsValuesArray };
					let attachments = getDoneSessionMessageAttachments(attachmentsConfig);
					let text = `Got it! I added ${durationMinutes} minutes to this priority. Would you like to take a break?`
					convoAskDoneSessionOptions(convo, text, attachments);

				}

				convo.next();

			}
		}
	]);

}

function switchWorkedOnPriority(convo, question = '') {

	const { sessionDone: { dailyTasks, defaultBreakTime } } = convo;

	let taskListMessage = convertArrayToTaskListMessage(dailyTasks);
	if (question == '') {
		question = `Which one of your ${dailyTasks.length} remaining priorities did you work on?\n${taskListMessage}`;
	}

	let buttonsValuesArray = [
		buttonValues.doneSession.itWasSomethingElse.value,
		buttonValues.neverMind.value
	];

	let text              = question;
	let attachmentsConfig = { buttonsValuesArray };
	let attachments       = getDoneSessionMessageAttachments(attachmentsConfig);

	convo.ask({
		text,
		attachments
	}, [
		{ // spentTimeOnSomethingElse
			pattern: utterances.somethingElse,
			callback: (response, convo) => {
				askToReplacePriority(convo);
				convo.next();
			}
		},
		{
			// never mind
			pattern: utterances.containsNoOrNeverMindOrNothing,
			callback: (response, convo) => {

				let buttonsValuesArray = [
					buttonValues.doneSession.completedPriorityTonedDown.value,
					buttonValues.doneSession.didSomethingElse.value,
					buttonValues.doneSession.notDone.value,
					buttonValues.doneSession.extendSession.value
				];

				let attachmentsConfig  = { defaultBreakTime, buttonsValuesArray };
				let attachments = getDoneSessionMessageAttachments(attachmentsConfig);
				let text = `Okay! What would you like to do with this session?`;
				convoAskDoneSessionOptions(convo, text, attachments);
				convo.next();

			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// needs to be a number, else repeat question
				let taskNumberArray = convertTaskNumberStringToArray(response.text, dailyTasks);
				if (taskNumberArray && taskNumberArray.length == 1) {

					let taskNumber = taskNumberArray[0]; // only one

					let dailyTaskIndexToSwitch = taskNumber - 1;
					convo.sessionDone.priorityDecision.switchPriority.newPriorityIndex = dailyTaskIndexToSwitch;

					convo.next();

				} else {
					// error
					let question = "Sorry, I didn't get that :thinking_face:. Let me know which priority you want to replace above `i.e. priority 2`";
					askToReplacePriority(convo, question);
					convo.next();
				}

			}
		}
	]);

}

function askToReplacePriority(convo, question = '') {

	const { sessionDone: { defaultBreakTime, dailyTasks, currentSession: { dailyTask } } } = convo;

	let taskListMessage = convertArrayToTaskListMessage(dailyTasks);
	if (question == '') {
		question = `Okay! If you want to log this with me, it will replace one of your priorities. Which priority above would you like to replace?`;
	}

	let buttonsValuesArray = [
		buttonValues.doneSession.keepMyPriority.value
	];
	let attachmentsConfig = { defaultBreakTime, buttonsValuesArray };
	let attachments       = getDoneSessionMessageAttachments(attachmentsConfig);
	let text              = question;

	convo.ask({
		text,
		attachments
	}, [
		{ // keepPriority
			pattern: utterances.containsKeep,
			callback: (response, convo) => {

				let buttonsValuesArray = [
					buttonValues.doneSession.takeBreak.value,
					buttonValues.doneSession.newSession.value,
					buttonValues.doneSession.viewPlan.value,
					buttonValues.doneSession.beBackLater.value
				];

				let attachmentsConfig  = { defaultBreakTime, buttonsValuesArray };
				let attachments = getDoneSessionMessageAttachments(attachmentsConfig);
				let text = `Good work! Now let’s refocus back on another priority for today after a quick break`;
				convoAskDoneSessionOptions(convo, text, attachments);
				convo.next();

			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// needs to be a number, else repeat question
				let taskNumberArray = convertTaskNumberStringToArray(response.text, dailyTasks);
				if (taskNumberArray && taskNumberArray.length == 1) {

					let taskNumber = taskNumberArray[0]; // only one

					let dailyTaskIndexToReplace = taskNumber - 1;
					convo.sessionDone.priorityDecision.replacePriority.dailyTaskIndexToReplace = dailyTaskIndexToReplace;
					askForPriorityReplacement(convo);
					convo.next();

				} else {
					// error
					let question = "Sorry, I didn't get that :thinking_face:. Let me know which priority you want to replace above `i.e. priority 2`";
					askToReplacePriority(convo, question);
					convo.next();
				}

			}
		}
	]);

}

function askForPriorityReplacement(convo) {

	const { sessionDone: { dailyTasks, priorityDecision: { replacePriority: { dailyTaskIndexToReplace } }, currentSession: { dailyTask } } } = convo;

	if (dailyTasks[dailyTaskIndexToReplace]) {

		let dailyTaskToReplace = dailyTasks[dailyTaskIndexToReplace];
		let taskTextToReplace = dailyTaskToReplace.dataValues.Task.text;

		convo.ask(`What did you do instead of \`${taskTextToReplace}\`?`, (response, convo) => {
			// DONE with this flow. all we need is which dailyTask to replace, and what text of newDailyTask will be.
			let newTaskText = response.text;
			convo.sessionDone.priorityDecision.replacePriority.newTaskText = newTaskText;
			convo.next();
		})

	} else {
		let question = "What priority would you like to replace?";
		askToReplacePriority(convo, question);
		convo.next();
	}
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
			customTimeObject = moment().tz(tz).add(TOKI_DEFAULT_BREAK_TIME, 'minutes');
		} else {
			customTimeObject = moment().tz(tz).add(defaultBreakTime, 'minutes');
		}

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
			customTimeObject = moment().tz(tz).add(TOKI_DEFAULT_SNOOZE_TIME, 'minutes');
		} else {
			customTimeObject = moment().tz(tz).add(defaultSnoozeTime, 'minutes');
		}

	}

	let customTimeString = customTimeObject.format("h:mm a");
	let durationMinutes  = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

	// the extend session time object
	convo.sessionDone.extendSession = customTimeObject;

	if (!defaultSnoozeTime && UserId) {
		convo.say({
			text: `I’ll see you at *${customTimeString}*! :clock1230: _(P.S. you can change your default extend by saying \`show settings\`)_`,
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
