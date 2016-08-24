import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, buttonValues, colorsHash, constants, startSessionOptionsAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';

// STARTING A SESSION
export default function(controller) {

	/**
	 *
	 * 		User directly asks to ping
	 * 							~* via Wit *~
	 */
	controller.hears(['ping'], 'direct_message', wit.hears, (bot, message) => {

		const { intentObject: { entities: { intent, reminder, duration, datetime } } } = message;
		
		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		let config = {
			SlackUserId,
			message
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {

			models.User.find({
				where: { SlackUserId }
			}).then((user) => {

				const { tz } = user;

				bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
					convo.say("PINGED!");
				});

			});

		}, 750);
	});

	controller.hears(['^pin[ng]{1,4}'], 'direct_message', (bot, message) => {

		const { intentObject: { entities: { intent, reminder, duration, datetime } } } = message;
		
		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		const pingSlackUserIds = getUniqueSlackUsersFromString(text);
		console.log("\n\n ~~ \n\n\n")
		console.log(text);
		console.log(pingSlackUserIds);
		console.log("\n\n ~~ \n\n\n")

		let config = {
			SlackUserId,
			message
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {

			models.User.find({
				where: { SlackUserId }
			}).then((user) => {

				const { tz } = user;

				bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
					convo.say("PINGED!");
				});

			});

		}, 750);
	});

	/**
	 * 		ACTUAL PING FLOW
	 * 		this will begin the ping flow with user
	 */
	controller.on('ping_flow', (bot, config) => {

		const { SlackUserId, content, minutes, changeTimeAndTask } = config;

		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

		});
	});

}

