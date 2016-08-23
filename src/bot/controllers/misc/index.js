import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';
import models from '../../../app/models';


export default function(controller) {

	/**
	 * DEFAULT FALLBACK
	 */
	controller.hears([''], 'direct_message', (bot, message) => {
		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "Hey! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin");
		}, 500);
	});

}


