import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones, tokiExplainAttachments } from '../../lib/constants';

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

			let replyMessage = "I'm not sure what you mean by that :thinking_face:";

			const config = { SlackUserId };

			// some fallbacks for button clicks
			switch (text) {
				case (text.match(utterances.keepWorking) || {}).input:
					controller.trigger(`current_session_status`, [bot, config])
					break;
				default:
					bot.reply(message, replyMessage);
					controller.trigger(`current_session_status`, [bot, config])
					break;
			}

		}, 500);
	});

	controller.on('explain_toki_flow', (bot, config) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const { fromUserConfig, toUserConfig } = config;

		models.User.find({
			where: { SlackUserId: toUserConfig.SlackUserId }
		}).then((toUser) => {

			const { SlackUserId } = toUser;

			bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {

				// have 5-minute exit time limit
				if (convo)
					convo.task.timeLimit = 1000 * 60 * 5;

				convo.say(`Hey! <@${fromUserConfig.SlackUserId}> wanted me to explain how I can also help you execute on your most meaningful things each day`);
				convo.say(`Think of me as an office manager for each of your teammate's attention. I help you easily enter work sessions, and protect your focus from others, *so that you only get interrupted with messages that are actually urgent*`);
				convo.say(`On the flip side, *I make it easy for you to ping teammates when they're actually ready to switch contexts.* This lets you get your requests out of your head when you think of them, and make sure it gets to the recipient without interrupting their current focus`);
				convo.say({
					text: `Here's how I specifically help you do this:`,
					attachments: tokiExplainAttachments
				});
				convo.say(`I'm here whenever you're ready to go! Just let me know when you want to \`ping\` someone, or enter a \`focus\` session yourself :raised_hands:`);

				convo.on(`end`, (convo) => {

				});

			});

		});

	});

}


