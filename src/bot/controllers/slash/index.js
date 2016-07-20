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

import { resumeQueuedReachouts } from '../index';

// user wants to update settings!
export default function(controller) {

	/**
	 *      SLASH COMMAND FLOW
	 */

	controller.on('slash_command', (bot, message) => {

		const SlackUserId = message.user;

		console.log(`slash command msg:`);
		console.log(message);

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const { nickName, SlackUser: { tz } } = user;

			// check message.command / message.text
			bot.replyPrivate(message, `hello your command was : ${message.command}!`);
			resumeQueuedReachouts(bot, { SlackUserId });

		});

	});

}
