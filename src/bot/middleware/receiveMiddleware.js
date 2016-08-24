import { wit, bots } from '../controllers/index';
import models from '../../app/models';

// add receive middleware to controller
export default (controller) => {

	controller.middleware.receive.use(wit.receive);

	// get sent messages from Toki, in order to update dynamically
	controller.middleware.receive.use(getBotSentMessages);

}

let getBotSentMessages = (bot, message, next) => {

	const { token } = bot.config;
	bot             = bots[token]; // use same bot every time

	if (!bot) {
		console.log("\n\n\n BOT NOT FOUND FOR SOME REASON");
		console.log(message);
		console.log("\n\n\n");
		next();
		return;
	}

	// sent messages organized by channel, and most recent 25 for them
	if (!bot.sentMessages) {
		bot.sentMessages = {};
	}
	let { bot_id, user, channel } = message;
	if (bot_id && channel) {

		if (bot.sentMessages[channel]) {

			// only most recent 25 messages per channel
			while (bot.sentMessages[channel].length > 25)
				bot.sentMessages[channel].shift();

			bot.sentMessages[channel].push(message);

		} else {
			bot.sentMessages[channel] = [ message ];
		}

	}
	
	next();
}