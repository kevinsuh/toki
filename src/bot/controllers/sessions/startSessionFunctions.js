import moment from 'moment-timezone';

import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getRandomExample } from '../../lib/messageHelpers';

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm task and time in one place and start if it's good
export function finalizeSessionTimeAndContent(convo) {

	const { SlackUserId, tz, content, minutes, currentSession }  = convo.sessionStart;

	// already in session, can only be in one
	if (currentSession) {

		let now           = moment().tz(tz);
		let endTime       = moment(currentSession.dataValues.endTime).tz(tz);
		let endTimeString = endTime.format("h:mma");
		let minutesLeft   = Math.round(moment.duration(endTime.diff(now)).asMinutes());

		let text = `Hey! You’re already in a focused session working on \`${currentSession.dataValues.content}\` until *${endTimeString}*`;
		let attachments = [
			{
				attachment_type: 'default',
				callback_id: "EXISTING_SESSION_OPTIONS",
				fallback: "Hey, you're already in a session!!",
				actions: [
					{
						name: buttonValues.newSession.name,
						text: "New Session :new:",
						value: buttonValues.newSession.value,
						type: "button"
					},
					{
						name: buttonValues.keepWorking.name,
						text: "Keep Working!",
						value: buttonValues.keepWorking.value,
						type: "button"
					}
				]
			}
		]

		convo.ask({
			text,
			attachments
		}, [
			{
				pattern: utterances.containsNew,
				callback: (response, convo) => {
					convo.say(`Okay, sounds good to me!`);
					convo.sessionStart.minutes = false;
					convo.sessionStart.content = false;
					finalizeSessionTimeAndContent(convo);
					convo.next();
				}
			},
			{
				pattern: utterances.containsKeep,
				callback: (response, convo) => {

					convo.say(`You got this! Keep focusing on \`${currentSession.dataValues.content}\` and I’ll see you at *${endTimeString}*`);
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

		// we need both time and task in order to start session
		// if dont have either, will run function before `convo.next`
		if (!content) {
			askForSessionContent(convo);
			return;
		} else if (!minutes) {
			askForSessionTime(convo);
			return;
		}

		convo.sessionStart.confirmStart = true;

	}

	convo.next();

}

/**
 *    CHOOSE SESSION TASK
 */
// ask which task the user wants to work on
function askForSessionContent(convo) {

	const { SlackUserId, tz, content, minutes }  = convo.sessionStart;

	const sessionExample = getRandomExample("session");
	
	convo.ask({
		text: `What would you like to focus on right now? (i.e. \`${sessionExample}\`)`,
	},[
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say(`Okay! Let me know when you want to \`get focused\``);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				const { intentObject: { entities: { reminder } } } = response;
				
				// reminder is necessary to be session content
				if (reminder) {

					// optionally accept time here
					let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
					if (customTimeObject) {
						let now = moment().tz(tz);
						let minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
						convo.sessionStart.minutes = minutes;
						convo.next();
					}

					convo.sessionStart.content = reminder[0].value;
					finalizeSessionTimeAndContent(convo);

				} else {
					convo.say(`I didn't get that :thinking_face:`);
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
		text: `How long would you like to work on \`${content}\`?`,
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
				convo.say(`Okay, let's change tasks!`);
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


