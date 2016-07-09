'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _index = require('../controllers/index');

// add receive middleware to controller

exports.default = function (controller) {

	controller.middleware.receive.use(_index.wit.receive);

	controller.middleware.receive.use(function (bot, message, next) {
		var bot_id = message.bot_id;

		if (bot_id) {
			// attach the message to the bot
			var sentMessages = bot.sentMessages;

			if (sentMessages) {
				bot.sentMessages.push(message);
			} else {
				bot.sentMessages = [message];
			}
		}

		next();
	});
};
//# sourceMappingURL=receiveMiddleware.js.map