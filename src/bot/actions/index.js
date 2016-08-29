import { wit } from '../controllers';
import http from 'http';
import bodyParser from 'body-parser';

// initiate conversation on first install
export function firstInstallInitiateConversation(bot, team) {

	var config = {
		SlackUserId: team.createdBy
	}

	bot.startPrivateConversation({user: team.createdBy}, (err, convo) => {

		/**
		 * 		INITIATE CONVERSATION WITH INSTALLER
		 */
		
		convo.say(`Hey! I'm Toki!`);
		convo.say(`This is your first time installing me`);

		convo.on('end', (convo) => {
			// let's save team info to DB
			console.log("\n\nteam info:\n\n")
			console.log(team);
			
		});

	});

}

// initiate conversation on login
export function loginInitiateConversation(bot, identity) {

	console.log("initiating convo with user who just logged in");
	console.log(identity);

}
