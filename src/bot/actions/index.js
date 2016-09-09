import { wit, bots } from '../controllers';
import http from 'http';
import bodyParser from 'body-parser';
import models from '../../app/models';

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
		
		convo.say(`Hey! I'm Toki!`);
		convo.say(`Thanks for inviting me to your team. I'm excited to work together :grin:`);

		convo.on('end', (convo) => {
			// let's save team info to DB
			console.log("\n\nteam info:\n\n")
			console.log(team);
			
		});

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
			convo.say(`Let's win this day. Let me know when you're ready to \`/focus\``);

		});



	});

}
