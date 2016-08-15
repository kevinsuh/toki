import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { colorsArray, constants, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, getSettingsAttachment } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog, witTimeResponseToTimeZoneObject } from '../../lib/miscHelpers';

import { resumeQueuedReachouts } from '../index';

// the home view of user's settings
export function settingsHome(convo) {

	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;
	const { task }                = convo;
	const { bot, source_message } = task;

	let text = `Here are your settings:`;
	let attachments = getSettingsAttachment(settings);
	convo.say({
		text,
		attachments
	});

	askWhichSettingsToUpdate(convo);


}

function askWhichSettingsToUpdate(convo, text = false) {

	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;
	const { task }                = convo;
	const { bot, source_message } = task;

	if (!text)
		text = `Which of these settings would you like me to update?`

	convo.ask({
		text,
		attachments: [{
			callback_id: "UPDATE_SETTINGS",
			fallback: `Would you like to update a settings?`,
			color: colorsHash.grey.hex,
			attachment_type: 'default',
			actions: [
				{
					name: buttonValues.neverMind.name,
					text: "Good for now!",
					value: buttonValues.neverMind.value,
					type: "button"
				}
			]
		}]
	}, [
		{ // change name
			pattern: utterances.containsName,
			callback: (response, convo) => {
				convo.say(`Sure thing!`);
				changeName(convo);
				convo.next();
			}
		},
		{ // change timeZone
			pattern: utterances.containsTimeZone,
			callback: (response, convo) => {
				changeTimeZone(convo);
				convo.next();
			}
		},
		{ // change morning ping
			pattern: utterances.containsPing,
			callback: (response, convo) => {
				changeMorningPing(convo);
				convo.next();
			}
		},
		{ // change extend duration
			pattern: utterances.containsExtend,
			callback: (response, convo) => {
				convo.say(`CHANGING EXTEND`);
				convo.next();
			}
		},
		{ // change break duration
			pattern: utterances.containsBreak,
			callback: (response, convo) => {
				convo.say(`CHANGING BREAK`);
				convo.next();
			}
		},
		{ // change priority sharing
			pattern: utterances.containsPriority,
			callback: (response, convo) => {
				convo.say(`CHANGING PRIORITY`);
				convo.next();
			}
		},
		{
			// no or never mind to exit this flow
			pattern: utterances.containsNoOrNeverMindOrNothing,
			callback: (response, convo) => {
				convo.say(`Okay! Let me know whenever you want to \`edit settings\``);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				const text = "Sorry, I didn't get that. Which specific settings would you like to update? `i.e. morning ping`";
				askWhichSettingsToUpdate(convo, text);
				convo.next();
			}
		}
	]);

}

// user wants to change name
function changeName(convo) {

	let { settings: { nickName } } = convo;

	convo.ask({
		text: "What would you like me to call you?",
		attachments: [{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_NAME",
			fallback: "What would you like me to call you?",
			actions: [
				{
					name: buttonValues.keepName.name,
					text: `Keep my name!`,
					value: buttonValues.keepName.value,
					type: "button"
				}
			]
		}]
	}, [
		{
			pattern: utterances.containsKeep,
			callback: (response, convo) => {

				convo.say(`Phew :sweat_smile: I really like the name ${nickName} so I'm glad you kept it`);
				settingsHome(convo);
				convo.next();

			}
		},
		{
			default: true,
			callback: (response, convo) => {
				nickName = response.text;
				convo.settings.nickName = nickName;
				convo.say(`Ooh I like the name ${nickName}! It has a nice ring to it`);
				settingsHome(convo);
				convo.next();
			}
		}
	]);
}

// user wants to change timezone
function changeTimeZone(convo) {

	const { settings: { SlackUserId, timeZone } } = convo;

	convo.ask({
		text: `I have you in the *${timeZone.name}* timezone. What timezone are you in now?`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "SETTINGS_CHANGE_TIMEZONE",
				fallback: "What's your timezone?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.timeZones.eastern.name,
						text: `Eastern`,
						value: buttonValues.timeZones.eastern.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.central.name,
						text: `Central`,
						value: buttonValues.timeZones.central.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.mountain.name,
						text: `Mountain`,
						value: buttonValues.timeZones.mountain.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.pacific.name,
						text: `Pacific`,
						value: buttonValues.timeZones.pacific.value,
						type: "button"
					},
					{
						name: buttonValues.timeZones.other.name,
						text: `Other`,
						value: buttonValues.timeZones.other.value,
						type: "button"
					}
				]
			}
		]
	}, [
			{
				pattern: utterances.other,
				callback: (response, convo) => {
					convo.say("I’m only able to work in these timezones right now. If you want to demo Toki, just pick one of these timezones. I’ll try to get your timezone included as soon as possible!");
					convo.repeat();
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				const { text }  = response;
				let newTimeZone = false;

				switch (text) {
					case (text.match(utterances.eastern) || {}).input:
						newTimeZone = timeZones.eastern;
						break;
					case (text.match(utterances.central) || {}).input:
						newTimeZone = timeZones.central;
						break;
					case (text.match(utterances.mountain) || {}).input:
						newTimeZone = timeZones.mountain;
						break;
					case (text.match(utterances.pacific) || {}).input:
						newTimeZone = timeZones.pacific;
					default:
						break;
				}

				if (newTimeZone) {
					convo.settings.timeZone = newTimeZone;

					// update it here because morningPing might depend on changed timezone
					const { tz } = newTimeZone;
					models.SlackUser.update({
						tz
					}, {
						where: [`"SlackUserId" = ?`, SlackUserId]
					});
					settingsHome(convo);

				} else {
					convo.say("I didn't get that :thinking_face:");
					convo.repeat();
				}

				convo.next();
			}
		}
	]);

}

// user wants to change morning ping
function changeMorningPing(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;

	if (pingTime) {
		if (wantsPing) {
			// has ping right now and probably wants to disable
			editLivePingTime(convo);
		} else {
			// has ping time that is disabled, so can enable
			editDisabledPingTime(convo);
		}
	} else {
		// no existing ping time!
		setNewPingTime(convo);
		
	}

}

// live ping time ethat exists
function editLivePingTime(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;
	let currentPingTimeObject = moment(pingTime).tz(timeZone.tz);
	let currentPingTimeString = currentPingTimeObject.format("h:mm a");

	const text = `Your Morning Ping is set to ${currentPingTimeString} and it’s currently *enabled* so you are receiving a greeting each weekday morning to make a plan to win your day :medal:`;
	const attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_MORNING_PING",
			fallback: "When do you want a morning ping?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.changeTime.name,
					text: `Change Time :clock7:`,
					value: buttonValues.changeTime.value,
					type: "button"
				},
				{
					name: buttonValues.disable.name,
					text: `Disable`,
					value: buttonValues.disable.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: `Never Mind`,
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
				pattern: utterances.containsChange,
				callback: (response, convo) => {

					convo.settings.wantsPing = true;
					changePingTime(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.containsDisable,
				callback: (response, convo) => {

					convo.settings.wantsPing = false;
					convo.say(`Consider it done (because it is done :stuck_out_tongue_winking_eye:). You are no longer receiving morning pings each weekday`);
					settingsHome(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say(`Okay!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				convo.say("I didn't get that :thinking_face:");
				convo.repeat();
				convo.next();

			}
		}
	]);

}

// disabled ping time that exists
function editDisabledPingTime(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;
	let currentPingTimeObject = moment(pingTime).tz(timeZone.tz);
	let currentPingTimeString = currentPingTimeObject.format("h:mm a");

	const text = `Your Morning Ping is set to ${currentPingTimeString} but it’s currently *disabled* so you’re not receiving a greeting each weekday morning to make a plan to win your day`;
	const attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_MORNING_PING",
			fallback: "When do you want a morning ping?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.keepTime.name,
					text: `Enable + Keep Time`,
					value: buttonValues.keepTime.value,
					type: "button"
				},
				{
					name: buttonValues.changeTime.name,
					text: `Enable + Change Time`,
					value: buttonValues.changeTime.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: `Never Mind`,
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
				pattern: utterances.containsChange,
				callback: (response, convo) => {

					convo.settings.wantsPing = true;
					convo.say(`I love how you’re getting after it :raised_hands:`);
					changePingTime(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.containsKeep,
				callback: (response, convo) => {

					convo.settings.wantsPing = true;
					convo.say(`Got it! I’ll ping you at ${currentPingTimeString} to make a plan to win your day :world_map:`);
					settingsHome(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					convo.say(`Okay!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				convo.say("I didn't get that :thinking_face:");
				convo.repeat();
				convo.next();

			}
		}
	]);

}

// ping time for the first time!
function setNewPingTime(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;

	const text = `Would you like me to reach out each weekday morning to encourage you to make a plan to  achieve your most important outcomes?`;
	const attachments = [
		{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_MORNING_PING",
			fallback: "When do you want a morning ping?",
			color: colorsHash.grey.hex,
			actions: [
				{
					name: buttonValues.yes.name,
					text: `Yes!`,
					value: buttonValues.yes.value,
					type: "button"
				},
				{
					name: buttonValues.no.name,
					text: `Not right now`,
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

					convo.settings.wantsPing = true;
					convo.say(`I love how you’re getting after it :raised_hands:`);
					changePingTime(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.no,
				callback: (response, convo) => {
					convo.say(`Okay!`);
					settingsHome(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

				convo.say("I didn't get that :thinking_face:");
				convo.repeat();
				convo.next();

			}
		}
	]);

}

// ask to change the ping time!
function changePingTime(convo) {

	const { settings: { timeZone, wantsPing, pingTime } } = convo;

	convo.ask(`What time would you like me to reach out?`, (response, convo) => {

		const { intentObject: { entities: { datetime } } } = response;
		let customTimeObject = witTimeResponseToTimeZoneObject(response, timeZone.tz);
		let now = moment();

		if (customTimeObject && datetime) {

			// datetime success!
			convo.settings.pingTime = customTimeObject;
			let timeString = customTimeObject.format("h:mm a");
			convo.say(`Got it! I’ll ping you at ${timeString} to make a plan to win your day :world_map:`);
			convo.say(`I hope you have a great rest of the day!`);
			settingsHome(convo);
			convo.next();

		} else {
			convo.say("Sorry, I didn't get that :thinking_face: let me know a time like `8:30am`");
			convo.repeat();
		}
		convo.next();
	});
}



