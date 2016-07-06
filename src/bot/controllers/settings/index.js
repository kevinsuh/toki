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

		consoleLog("in settings!!!", message);

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

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name   = user.nickName || user.email;
				convo.name = name;

				convo.settings = {
					SlackUserId
				}

				startSettingsConversation(err, convo);

				convo.on('end', (convo) => {

					consoleLog("end of settings for user!!!!", convo.settings);

					const { SlackUserId, nickName, timeZone } = convo.onBoard;

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
	
	const { name } = convo;

	convo.say(`Hello ${name}! SETTINGS!`);
	
}


