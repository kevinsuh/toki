import { wit, bots } from '../controllers';
import http from 'http';
import bodyParser from 'body-parser';
import models from '../../app/models';

import { tokiExplainAttachments } from '../lib/constants';

// initiate conversation on first install
export function firstInstallInitiateConversation(bot, team) {

	var config = {
		SlackUserId: team.createdBy
	}

	let botToken    = bot.config.token;
	bot             = bots[botToken];

	bot.startPrivateConversation({user: team.createdBy}, (err, convo) => {

		/**
		 * 		INITIATE CONVERSATION WITH INSTALLER
		 */
		
		convo.say(`Hey <@${team.createdBy}>! I'm Toki. Nice to meet you :wave:`);
		convo.say({
			text: `I help empower deep work for teams. Here's how I do it:`,
			attachments: tokiExplainAttachments
		});
		convo.say(`I'm here whenever you're ready to go! Just let me know when you want to \`/focus\` on something. If you want to share me to others, you can \`/explain @user\``);

	});

}

// initiate conversation on login
export function loginInitiateConversation(bot, identity) {

	let SlackUserId = identity.user_id;
	let botToken    = bot.config.token;
	bot             = bots[botToken];

	models.User.find({
		where: { SlackUserId }
	})
	.then((user) => {

		const { scopes, accessToken } = user;

		bot.startPrivateConversation({user: SlackUserId}, (err, convo) => {

			/**
			 * 		INITIATE CONVERSATION WITH LOGIN
			 */
			convo.say(`Awesome!`);
			convo.say(`Let's win this day now. Let me know when you want to \`/focus\``);

		});



	});

}
