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
	let buttonsValuesArray = [];
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
				buttonValues.doneSession.didSomethingElse.value,
				buttonValues.doneSession.extendSession.value
			];

		} else {

			// send message if time is still remaining
			convo.say(`Your session for \`${taskText}\` is up. Excellent work!`);

			buttonsValuesArray = [
				buttonValues.doneSession.takeBreak.value,
				buttonValues.doneSession.extendSession.value,
				buttonValues.doneSession.completedPriorityTonedDown.value,
				buttonValues.doneSession.didSomethingElse.value,
				buttonValues.doneSession.viewPlan.value
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

	let attachmentsConfig  = { defaultBreakTime, defaultSnoozeTime, buttonsValuesArray };
	let attachments = getDoneSessionMessageAttachments(attachmentsConfig);
	convoAskDoneSessionOptions(convo, text, attachments);

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
				convo.priorityDecision.completeDailyTask = true;
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
				convo.say("You want a new session!");
				convo.next();
			}
		},
		{ // viewPlan
			pattern: utterances.containsPlan,
			callback: (response, convo) => {
				convo.sessionDone.postSessionDecision = intentConfig.VIEW_PLAN;
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
		{
			// no or never mind to exit this flow
			pattern: utterances.containsNoOrNeverMindOrNothing,
			callback: (response, convo) => {
				convo.say(`Okay! Let me know when you want to make progress on \`another priority\` :muscle:`);
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
	const { sessionDone: { tz, dailyTasks, defaultSnoozeTime, UserId, currentSession: { dailyTask } } } = convo;

	let taskText = dailyTask.Task.text;
	let text = `Got it - let's adjust your plan accordingly. How much additional time would you like to allocate to \`${taskText}\` for the rest of today?`;
	buttonsValuesArray = [
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
				askToReplacePriority(convo);
				convo.next();
			}
		},
		{ // moveOn
			pattern: utterances.moveOn,
			callback: (response, convo) => {
				
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
					convo.sessionDone.additionalMinutes = durationMinutes;

					let buttonsValuesArray = [
						buttonValues.doneSession.takeBreak.value,
						buttonValues.doneSession.newSession.value,
						buttonValues.doneSession.viewPlan.value
					];

					let attachmentsConfig  = { defaultBreakTime, defaultSnoozeTime, buttonsValuesArray };
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
		question = `Which one of your 3 priorities did you work on?\n${taskListMessage}`;
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
		question = `Great! If you want to log this with me, it will replace one of your priorities. Which priority would you like to replace?\n${taskListMessage}`;
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
					buttonValues.doneSession.viewPlan.value
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
			let newTaskText = response.text;
			convo.sessionDone.priorityDecision.replacePriority.newTaskText = newTaskText;
			convo.ask({
				text: `Did you complete \`${newTaskText}\`?`,
				attachments: [
					{
						attachment_type: 'default',
						callback_id: "FINISH_REPLACEMENT_PRIORITY",
						fallback: "Did you finish that prioritypriority?",
						color: colorsHash.grey.hex,
						actions: [
							{
									name: buttonValues.yes.name,
									text: "Yes :runner:",
									value: buttonValues.yes.value,
									type: "button"
							},
							{
									name: buttonValues.no.name,
									text: "No",
									value: buttonValues.no.value,
									type: "button"
							}
						]
					}
				]
			}, [
				{
					pattern: utterances.yes,
					callback: (response, convo) => {
						convo.say(`You're a star :star:. I updated your plan!`);
						convo.sessionDone.priorityDecision.replacePriority.completedPriority = true;
						convo.next();
					}
				},
				{
					pattern: utterances.no,
					callback: (response, convo) => {
						askForTimeToReplacementPriority(convo);
						convo.next();
					}
				},
				{
					default: true,
					callback: (response, convo) => {
						convo.say(`Hmm I didn't get that :thinking_face:`);
						convo.repeat();
						convo.next();
					}
				}
			])
			convo.next();
		})
	} else {
		let question = "What priority would you like to replace?";
		askToReplacePriority(convo, question);
		convo.next();
	}
}

function askForTimeToReplacementPriority(convo) {

	const { sessionDone: { tz, priorityDecision: { replacePriority: { dailyTaskIndexToReplace, newTaskText } } } } = convo;

	if (newTaskText) {
		convo.ask(`How much more time would you like to put toward \`${newTaskText}\`?`, (response, convo) => {
			// needs to be time
			let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
			if (customTimeObject) {

				let now = moment();
				let durationMinutes  = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
				convo.sessionDone.priorityDecision.replacePriority.additionalMinutes = durationMinutes;

				convo.next();

			} else {
				convo.say(`Huh, I didn't get a time from you :thinking_face:. Say something like \`30 more minutes\`!`);
				convo.repeat();
				convo.next();
			}
		})
	} else {
		askForPriorityReplacement(convo);
		convo.next();
	}
}

// function replaceDailyTasksWithNewPriority(convo) {
	
// 	const { sessionDone: { dailyTasks, priorityDecision: { replacePriority: { dailyTaskIndexToReplace, newTaskText, additionalMinutes } } } } = convo;

// 	if (dailyTasks && dailyTasks[dailyTaskIndexToReplace] && newTaskText) {

// 		let dailyTaskToReplace  = dailyTasks[dailyTaskIndexToReplace];
// 		dailyTaskToReplace.text = newTaskText;
// 		dailyTaskToReplace.type = "live";

// 		if (additionalMinutes) {
// 			dailyTaskToReplace.minutes = additionalMinutes;
// 			dailyTaskToReplace.done    = false;
// 		} else {
// 			dailyTaskToReplace.done    = true;
// 		}

// 		convo.dailyTasks = dailyTasks;

// 	}

// }

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
