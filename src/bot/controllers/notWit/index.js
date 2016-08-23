import os from 'os';
import { wit, bots } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones } from '../../lib/constants';

import dotenv from 'dotenv';

/**
 * 		Sometimes there is a need for just NL functionality not related
 * 		to Wit and Wit intents. Put those instances here, since they will
 * 		show up before Wit gets a chance to pick them up first.
 */

export default function(controller) {

	controller.hears([constants.THANK_YOU.reg_exp], 'direct_message', (bot, message) => {
		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "You're welcome!! :smile:");
		}, 500);
	});

	// TOKI_T1ME TESTER
	controller.hears(['TOKI_T1ME'], 'direct_message', (bot, message) => {

		const { text } = message;
		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{

			controller.trigger(`TOKI_TIME_flow`, [ bot, { SlackUserId }]);

		}, 1000);

	});


	controller.on('TOKI_TIME_flow', (bot, config) => {

		const { SlackUserId } = config;

		// IncluderSlackUserId is the one who's actually using Toki
		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

			const { email, SlackName, tz } = user;

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				convo.say(`Hey, @${SlackName}!  Nice to meet ya`);

			});
		});
	});

}
