import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, timeZones, tokiOptionsAttachment } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

// user wants to update settings!
export default function(controller) {

	controller.hears(['settings'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		var config = { SlackUserId };
		controller.trigger(`begin_settings_flow`, [ bot, config ]);

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

			const { nickName, SlackUser: { tz } } = user;
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
					nickName: name
				}

				startSettingsConversation(err, convo);

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

				});

			})

		});

	});

}

function startSettingsConversation(err, convo) {
	
	const { settings, settings: { timeZone, nickName } } = convo;

	var settingsAttachment = getSettingsAttachment(settings);
	convo.ask({
		text: `Hello ${nickName}! Here are your settings:`,
		attachments: settingsAttachment
	},
	[
		{
			pattern: buttonValues.changeName.value,
			callback: (response, convo) => {
				convo.say("u want to change name");
				convo.next();
			}
		},
		{ // same as buttonValues.changeName.value
			pattern: utterances.containsName,
			callback: (response, convo) => {
				convo.say("u want to change name");
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
			default: true,
			callback: (response, convo) => {
				// for now this will be where "never mind" goes
				convo.say("If you change your mind, just tell me that you want to `show settings`");
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
				returnToMainSettings(response, convo);
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

	convo.say("Oops dont have that feature right now");
	convo.next();

}

// return after updating statuses
function returnToMainSettings(response, convo) {

	const { settings, settings: { timeZone, nickName } } = convo;

	var settingsAttachment = getSettingsAttachment(settings);

	convo.ask({
		text: `Here are your updated settings. Is there anything else I can help you with?`,
		attachments: settingsAttachment
	},
	[
		{
			pattern: buttonValues.changeName.value,
			callback: (response, convo) => {
				convo.say("u want to change name");
				convo.next();
			}
		},
		{ // same as buttonValues.changeName.value
			pattern: utterances.containsName,
			callback: (response, convo) => {
				convo.say("u want to change name");
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
			default: true,
			callback: (response, convo) => {
				// for now this will be where "never mind" goes
				convo.say("Happy to help. Now let's get back to it");
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

	const { timeZone, nickName } = settings;

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
					value: timeZone.tz,
					short: true
				}
			],
			actions: [
				{
					name: buttonValues.changeName.name,
					text: "Change name",
					value: buttonValues.changeName.value,
					type: "button"
				},
				{
					name: buttonValues.changeTimeZone.name,
					text: "Switch Timezone",
					value: buttonValues.changeTimeZone.value,
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


