import moment from 'moment-timezone';

import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString } from '../../lib/messageHelpers';

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm task and time in one place and start if it's good
export function finalizeSessionTimeAndContent(convo) {

	const { SlackUserId, tz, content, minutes, currentSession }  = convo.sessionStart;

	// we need both time and task in order to start session
	if (!content) {
		askForSessionContent(convo);
		return;
	} else if (!minutes) {
		askForSessionTime(convo);
		return;
	}

	// will only be a single task now
	let taskText = dailyTask.dataValues ? `\`${dailyTask.dataValues.Task.text}\`` : 'your task';

	// will only be a single task now
	let timeString     = convertMinutesToHoursString(minutes);
	let calculatedTime = calculatedTimeObject.format("h:mma");

	let question = `Ready to work on ${taskText} for ${timeString} until *${calculatedTime}*?`;

	// already in session, can only be in one
	if (currentSession) {

		question = `You're currently in a session for \`${currentSession.dataValues.content}\` and *NEED_MINUTES* remaining! Would you like to cancel that and start a new session instead?`;
		convo.ask(question, [
			{
				pattern: utterances.yes,
				callback: (response, convo) => {
					convo.sessionStart.confirmOverRideSession = true;
					convo.say(`Okay, sounds good to me!`);
					convo.next();
				}
			},
			{
				pattern: utterances.no,
				callback: (response, convo) => {

					let text = '';
					convo.say(`Okay! Good luck and see you in *NEED_MINUTES*`);
					convo.next();

				}
			},
			{
				default: true,
				callback: (response, convo) => {
					convo.say("Sorry, I didn't catch that");
					convo.repeat();
					convo.next();
				}
			}
		]);

	} else {

		convo.sessionStart.confirmStart = true;
		
	}

}

/**
 *    CHOOSE SESSION TASK
 */
// ask which task the user wants to work on
function askForSessionContent(convo) {

	const { SlackUserId }  = convo.sessionStart;

	const sessionExample = getRandomExample("session");
	
	convo.ask({
		text: `What would you like to focus on right now? (i.e. \`${sessionExample}\`)`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "START_SESSION",
				fallback: "I was unable to process your decision",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.neverMind.name,
							text: "Never mind!",
							value: buttonValues.neverMind.value,
							type: "button",
					}
				]
			}
		]
	},[
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say(`Okay! Let me know when you want to \`start a session\``);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// optionally accept time here
				const { intentObject: { entities: { reminder, duration, datetime } } } = response;
				let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
				if (customTimeObject) {
					let now = moment().tz(tz);
					let minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
					convo.sessionStart.minutes = minutes;
					convo.next();
				}

				// reminder is necessary to be session content
				if (reminder) {
					convo.sessionStart.content = reminder[0].value;
					finalizeSessionTimeAndContent(convo);
				} else {
					convo.say(`I didn't get that`);
					convo.repeat();
				}
				convo.next();
			}
		}
	]);

}

function askForSessionTime(convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { SlackUserId, tz, content, minutes }  = convo.sessionStart;

	// get time to session
	convo.ask({
		text: `How long would you like to work on \`${content}\``,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "START_SESSION",
				fallback: "How long do you want to work on this?",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.changeTasks.name,
							text: "Wait, change task",
							value: buttonValues.changeTasks.value,
							type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: utterances.containsChange,
			callback: (response, convo) => {
				convo.say(`Okay, let's change tasks`);
				convo.sessionStart.content = false;
				finalizeSessionTimeAndContent(convo);;
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let now                            = moment().tz(tz);
				let { intentObject: { entities } } = response;
				// for time to tasks, these wit intents are the only ones that makes sense
				let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
				if (customTimeObject) {
					let minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
					convo.sessionStart.minutes = minutes;
					finalizeSessionTimeAndContent(convo);
					convo.next();
				} else {
					// invalid
					convo.say("I'm sorry, I didn't catch that :dog:");
					let question = `How much more time did you want to add to \`${content}\` today?`;
					convo.repeat();
				}

				convo.next();

			}
		}
	]);

	convo.next();

}


