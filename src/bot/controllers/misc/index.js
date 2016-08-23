import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones } from '../../lib/constants';

export default function(controller) {

	/**
	 * DEFAULT FALLBACK
	 */
	controller.hears([constants.ANY_CHARACTER.reg_exp], 'direct_message', (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const { text } = message;

		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {

			let replyMessage = "Hey! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin";

			const config = { SlackUserId };

			// some fallbacks for button clicks
			switch (text) {
				case (text.match(utterances.keepWorking) || {}).input:
					controller.trigger(`current_session_status`, [bot, config])
					break;
				default:
					bot.reply(message, replyMessage);
					break;
			}

		}, 500);
	});

}


