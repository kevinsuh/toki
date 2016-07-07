import { wit } from '../controllers/index';

// add receive middleware to controller
export default (controller) => {

	controller.middleware.receive.use(wit.receive);

	controller.middleware.receive.use((bot, message, next) => {

		var { bot_id } = message;
		if (bot_id) {
			// attach the message to the bot
			var { sentMessages } = bot;
			if (sentMessages) {
				bot.sentMessages.push(message);
			} else {
				bot.sentMessages = [ message ];
			}
		}
		
		next();

});

}