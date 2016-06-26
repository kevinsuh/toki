import { wit } from '../../controllers';
import { randomInt } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

// initiate conversation on first install
export function firstInstallInitiateConversation(bot, team) {

	bot.startPrivateConversation({user: team.createdBy}, (err, convo) => {

		/**
		 * 		INITIATE CONVERSATION WITH INSTALLER
		 */
		
		convo.say(`Hey! I'm Toki!`);
		convo.say(`This is your first time installing me`);
	});

}

// initiate conversation on login
export function loginInitiateConversation(bot, team) {
	console.log("in login initiate convo")
	console.log(team);

	bot.startPrivateConversation({user: team.createdBy}, (err, convo) => {
		
		convo.say(`Hey! I'm Toki!`);
		convo.say(`I'm logged in and ready to go`);
	});

}
