import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones } from '../../lib/constants';

export default function(controller) {

	/**
	 * DEFAULT FALLBACK
	 */
	controller.hears([constants.ANY_CHARACTER.reg_exp], 'direct_message', (bot, message) => {
		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "Hey! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin");
		}, 500);
	});

	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

		// user said something outside of wit's scope
		if (!message.selectedIntent) {

			bot.send({
				type: "typing",
				channel: message.channel
			});

			setTimeout(() => {
				bot.reply(message, "Hey (wit intent)! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin");
			}, 500);

		}

	});

}


