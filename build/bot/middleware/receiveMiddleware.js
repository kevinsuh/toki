'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _index = require('../controllers/index');

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// add receive middleware to controller
exports.default = function (controller) {

	controller.middleware.receive.use(_index.wit.receive);

	// get sent messages from Toki, in order to update dynamically
	controller.middleware.receive.use(getBotSentMessages);
};

var getBotSentMessages = function getBotSentMessages(bot, message, next) {
	var token = bot.config.token;

	bot = _index.bots[token]; // use same bot every time

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
	var bot_id = message.bot_id;
	var user = message.user;
	var channel = message.channel;

	if (bot_id && channel) {

		if (bot.sentMessages[channel]) {

			// only most recent 25 messages per channel
			while (bot.sentMessages[channel].length > 25) {
				bot.sentMessages[channel].shift();
			}bot.sentMessages[channel].push(message);
		} else {
			bot.sentMessages[channel] = [message];
		}
	}

	next();
};
//# sourceMappingURL=receiveMiddleware.js.map