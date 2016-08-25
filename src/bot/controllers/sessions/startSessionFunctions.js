import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getRandomExample } from '../../lib/messageHelpers';

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
export function confirmTimeZoneExistsThenStartSessionFlow(convo, text = `Ah! Since I help you make time for your priorities, I need to know your *timezone* before we continue`) {

	const { SlackUserId, UserId, tz }  = convo.sessionStart;

	if (!tz) { // user needs tz config'd!
		convo.ask({
			text,
			attachments: timeZoneAttachments
		}, (response, convo) => {
			const { text } = response;
			let timeZoneObject = false;
			switch (text) {
				case (text.match(utterances.eastern) || {}).input:
					timeZoneObject = timeZones.eastern;
					break;
				case (text.match(utterances.central) || {}).input:
					timeZoneObject = timeZones.central;
					break;
				case (text.match(utterances.mountain) || {}).input:
					timeZoneObject = timeZones.mountain;
					break;
				case (text.match(utterances.pacific) || {}).input:
					timeZoneObject = timeZones.pacific;
					break;
				case (text.match(utterances.other) || {}).input:
					timeZoneObject = timeZones.other;
					break;
				default:
					break;
			}

			if (!timeZoneObject) {
				convo.say("I didn't get that :thinking_face:");
				confirmTimeZoneExistsThenStartSessionFlow(convo, `Which timezone are you in?`);
				convo.next();
			} else if (timeZoneObject == timeZones.other) {
				convo.say(`Sorry!`);
				convo.say("Right now I’m only able to work in these timezones. If you want to demo Toki, just pick one of these timezones for now. I’ll try to get your timezone included as soon as possible!");
				confirmTimeZoneExistsThenStartSessionFlow(convo, `Which timezone do you want to go with for now?`);
				convo.next();
			} else { // success!!

				const { tz } = timeZoneObject;
				models.User.update({
					tz
				}, {
					where: { id: UserId }
				})
				.then(() => {
					convo.say(`Great! If this ever changes, you can always \`update settings\``);
					finalizeSessionTimeAndContent(convo); // entry point
					convo.next();
				});

			}

		});

	} else { // user already has tz config'd!
		finalizeSessionTimeAndContent(convo); // entry point
		convo.next();
	}

}

// confirm task and time in one place and start if it's good
function finalizeSessionTimeAndContent(convo) {

	const { SlackUserId, tz, content, minutes, currentSession, changeTimeAndTask }  = convo.sessionStart;

	if (currentSession) {

		/*
		 * ONLY IF YOU'RE CURRENTLY IN A SESSION...
		 */
		
		if (changeTimeAndTask) {
			// clicking button `change time + task`
			changeTimeAndTaskFlow(convo);
		} else {
			// wit `new session`
			askToOverrideCurrentSession(convo);
		}

	} else {

		/*
		 * STANDARD FLOW
		 */

		// we need both time and task in order to start session
		// if dont have either, will run function before `convo.next`
		
		if (!content) {
			askForSessionContent(convo);
			return;
		} else if (!minutes) {
			askForSessionTime(convo);
			return;
		}

		convo.sessionStart.confirmNewSession = true;

	}

	convo.next();

}

function changeTimeAndTaskFlow(convo) {

	const { SlackUserId, tz, currentSession }  = convo.sessionStart;

	// we are restarting data so user can seamlessly create a new session
	convo.sessionStart.content        = currentSession.dataValues.content;
	convo.sessionStart.minutes        = false;
	convo.sessionStart.currentSession = false;

	let text = `Would you like to work on something other than \`${convo.sessionStart.content}\`?`;
	let attachments = [
		{
			attachment_type: 'default',
			callback_id: "EXISTING_SESSION_OPTIONS",
			fallback: "Hey, you're already in a session!!",
			actions: [
				{
					name: buttonValues.yes.name,
					text: "Yes",
					value: buttonValues.yes.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: "Nah, keep it!",
					value: buttonValues.no.value,
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
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.sessionStart.content = false;
				let question = `What would you like to focus on?`;
				askForSessionContent(convo, question);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				finalizeSessionTimeAndContent(convo);
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
	

}

function askToOverrideCurrentSession(convo) {

	const { SlackUserId, tz, content, minutes, currentSession }  = convo.sessionStart;

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

				// restart everything!
				convo.sessionStart.minutes        = false;
				convo.sessionStart.content        = false;
				convo.sessionStart.currentSession = false;

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

}

/**
 *    CHOOSE SESSION TASK
 */
// ask which task the user wants to work on
function askForSessionContent(convo, question = '') {

	const { SlackUserId, tz, content, minutes }  = convo.sessionStart;

	const sessionExample = getRandomExample("session");

	if (question == '')
		question = `What would you like to focus on right now? (i.e. \`${sessionExample}\`)`;

	convo.ask({
		text: question,
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


