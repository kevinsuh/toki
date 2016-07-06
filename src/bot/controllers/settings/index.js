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
				convo.say("u want to change timezone");
				convo.next();
			}
		},
		{ // same as buttonValues.changeTimeZone.value
			pattern: utterances.containsTimeZone,
			callback: (response, convo) => {
				convo.say("u want to change timezone");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				// for now this will be where "never mind" goes
				convo.say("you said never mind");
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


