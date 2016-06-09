import { wit } from '../../controllers';
import { randomInt } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

// base controller to start actions
export function firstInstallInitiateConversation(bot, team) {

	bot.send({
        type: "typing",
        channel: message.channel
  });
  setTimeout(() => {
  	bot.startPrivateConversation({user: team.createdBy}, (err, convo) => {

  		/**
  		 * 		INITIATE CONVERSATION WITH INSTALLER
  		 */
  		
  		convo.say(`Hey! I'm Navi`);
		}
	)}, randomInt(1500, 2350));

}