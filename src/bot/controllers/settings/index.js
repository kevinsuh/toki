import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { resumeQueuedReachouts } from '../index';

// user wants to update settings!
export default function(controller) {

	controller.hears(['settings'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		var config = { SlackUserId };

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			controller.trigger(`begin_settings_flow`, [ bot, config ]);
		}, 850);

	});

	/**
	 *      SETTINGS FLOW
	 */

	controller.on('begin_settings_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const { nickName, defaultSnoozeTime, defaultBreakTime, SlackUser: { tz } } = user;
			var userTimeZone = {};
			for (var key in timeZones) {
				if (timeZones[key].tz == tz) {
					userTimeZone = timeZones[key];
				}
			}

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name   = user.nickName || user.email;
				convo.name = name;

				convo.settings = {
					SlackUserId,
					timeZone: userTimeZone,
					nickName: name,
					defaultBreakTime,
					defaultSnoozeTime
				}

				startSettingsConversation(err, convo);
				convo.next();

				convo.on('end', (convo) => {

					consoleLog("end of settings for user!!!!", convo.settings);

					const { SlackUserId, nickName, timeZone } = convo.settings;

					if (timeZone) {
						const { tz } = timeZone;

						user.SlackUser.update({
							tz
						});

					}

					if (nickName) {

						user.update({
							nickName
						});

					}

					resumeQueuedReachouts(bot, { SlackUserId });

				});

			})

		});

	});

}

function startSettingsConversation(err, convo) {
	
	const { settings: { nickName } } = convo;
	convo.say(`Hello ${nickName}!`);
	showSettingsOptions(convo);

}

function showSettingsOptions(convo) {
	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;

	var settingsAttachment = getSettingsAttachment(settings);
	convo.ask({
		text: `Here are your settings:`,
		attachments: settingsAttachment
	},
	[
		{
			pattern: buttonValues.changeName.value,
			callback: (response, convo) => {
				changeName(response, convo);
				convo.next();
			}
		},
		{ // same as buttonValues.changeName.value
			pattern: utterances.containsName,
			callback: (response, convo) => {
				changeName(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeTimeZone.value,
			callback: (response, convo) => {
				changeTimezone(response, convo);
				convo.next();
			}
		},
		{ // same as buttonValues.changeTimeZone.value
			pattern: utterances.containsTimeZone,
			callback: (response, convo) => {
				changeTimezone(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeDefaultSnoozeTime.value,
			callback: (response, convo) => {
				changeDefaultSnoozeTime(response, convo);
				convo.next();
			}
		},
		{ // same as buttonValues.changeDefaultSnoozeTime.value
			pattern: utterances.containsSnooze,
			callback: (response, convo) => {
				changeDefaultSnoozeTime(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeDefaultBreakTime.value,
			callback: (response, convo) => {
				changeDefaultBreakTime(response, convo);
				convo.next();
			}
		},
		{ // same as buttonValues.changeDefaultBreakTime.value
			pattern: utterances.containsBreak,
			callback: (response, convo) => {
				changeDefaultBreakTime(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				// for now this will be where "never mind" goes
				convo.say("If you change your mind, just tell me that you want to `show settings`");
				convo.next();
			}
		}
	]);

}

function changeDefaultBreakTime(response, convo) {

	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;
	convo.ask(`How many minutes do you want your default break time to be?`, [
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay!");
				showSettingsOptions(convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// must be a number
				var time    = response.text;
				var minutes = false;
				var validMinutesTester = new RegExp(/[\dh]/);

				if (validMinutesTester.test(time)) {
					minutes = convertTimeStringToMinutes(time);
				}

				if (minutes) {
					convo.settings.defaultBreakTime = minutes;
					returnToMainSettings(response, convo);
				} else {
					convo.say("Sorry, still learning :dog:. Let me know in terms of minutes `i.e. 10 min`");
					convo.repeat();
				}
				convo.next();

			}
		}
	]);

}

function changeDefaultSnoozeTime(response, convo) {

	const { settings, settings: { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } } = convo;
	convo.ask(`How many minutes do you want your default extend time to be? :timer_clock:`, [
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay!");
				showSettingsOptions(convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// must be a number
				var time    = response.text;
				var minutes = false;
				var validMinutesTester = new RegExp(/[\dh]/);

				if (validMinutesTester.test(time)) {
					minutes = convertTimeStringToMinutes(time);
				}

				if (minutes) {
					convo.settings.defaultSnoozeTime = minutes;
					returnToMainSettings(response, convo);
				} else {
					convo.say("Sorry, still learning :dog:. Let me know in terms of minutes `i.e. 10 min`");
					convo.repeat();
				}
				convo.next();

			}
		}
	]);
}

// user wants to change time zones
function changeTimezone(response, convo) {

	const { settings, settings: { timeZone, nickName } } = convo;
	convo.ask({
		text: `Which timezone are you in now?`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "CHANGE_TIME_ZONE",
				fallback: "What's your timezone?",
				color: colorsHash.blue.hex,
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
			pattern: buttonValues.timeZones.eastern.value,
			callback: (response, convo) => {
				convo.settings.timeZone = timeZones.eastern;
				returnToMainSettings(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.central.value,
			callback: (response, convo) => {
				convo.settings.timeZone = timeZones.central;
				returnToMainSettings(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.mountain.value,
			callback: (response, convo) => {
				convo.settings.timeZone = timeZones.mountain;
				returnToMainSettings(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.pacific.value,
			callback: (response, convo) => {
				convo.settings.timeZone = timeZones.pacific;
				returnToMainSettings(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.timeZones.other.value,
			callback: (response, convo) => {
				askOtherTimeZoneOptions(response, convo);
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

// user wants other time zone
function askOtherTimeZoneOptions(response, convo) {

	convo.say("As Toki the Time Fairy, I need to get this right :grin:");
	convo.ask("What is your timezone?", (response, convo) => {

		var timezone = response.text;
		if (false) {
			// functionality to try and get timezone here
			
		} else {
			convo.say("I'm so sorry, but I don't support your timezone yet for this beta phase, but I'll reach out when I'm ready to help you work");
		}

		returnToMainSettings(response, convo);
		convo.next();

	});

	convo.next();

}

// return after updating statuses
function returnToMainSettings(response, convo) {

	const { settings, settings: { timeZone, nickName } } = convo;

	var settingsAttachment = getSettingsAttachment(settings);

	convo.say(`Got it, I've made those updates!`);
	showSettingsOptions(convo);

}

// user wants to change name
function changeName(response, convo) {
	convo.ask("What would you like me to call you?", (response, convo) => {
		confirmName(response.text, convo);
		convo.next();
	});
}

function confirmName(name, convo) {

	convo.ask(`So you'd like me to call you *${name}*?`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.settings.nickName = name;
				convo.say(`It's a pleasure to be working with you, ${name}`);
				returnToMainSettings(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				changeName(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say("Sorry, I didn't get that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);

}


/**
 * use this to generate the attachment of user's current settings
 * @param  {User} user user obj. w/ SlackUser attached to it
 * @return {array}      array that is the slack message attachment
 */
function getSettingsAttachment(settings) {

	var { timeZone, nickName, defaultSnoozeTime, defaultBreakTime } = settings;
	if (!defaultSnoozeTime) {
		defaultSnoozeTime = TOKI_DEFAULT_SNOOZE_TIME;
	}
	if (!defaultBreakTime) {
		defaultBreakTime = TOKI_DEFAULT_BREAK_TIME;
	}

	var attachment = [
		{
			callback_id: "SETTINGS",
			fallback: `Here are your settings`,
			color: colorsHash.grey.hex,
			attachment_type: 'default',
			fields: [
				{
					title: `Name:`,
					short: true
				},
				{
					value: nickName,
					short: true
				},
				{
					title: `Timezone:`,
					short: true
				},
				{
					value: timeZone.name,
					short: true
				},
				{
					title: `Default Extend Time :timer_clock::`,
					short: true
				},
				{
					value: `${defaultSnoozeTime} min`,
					short: true
				},
				{
					title: `Default Break Time:`,
					short: true
				},
				{
					value: `${defaultBreakTime} min`,
					short: true
				},
				{
					value: "Would you like me to update any of these settings?"
				}
			],
			actions: [
				{
					name: buttonValues.changeName.name,
					text: "Name",
					value: buttonValues.changeName.value,
					type: "button"
				},
				{
					name: buttonValues.changeTimeZone.name,
					text: "Timezone",
					value: buttonValues.changeTimeZone.value,
					type: "button"
				},
				{
					name: buttonValues.changeDefaultSnoozeTime.name,
					text: "Extend Time",
					value: buttonValues.changeDefaultSnoozeTime.value,
					type: "button"
				},
				{
					name: buttonValues.changeDefaultBreakTime.name,
					text: "Break Time",
					value: buttonValues.changeDefaultBreakTime.value,
					type: "button"
				},
				{
					name: buttonValues.neverMind.name,
					text: "Good for now!",
					value: buttonValues.neverMind.value,
					type: "button"
				}
			]
		}
	];

	return attachment;

}


