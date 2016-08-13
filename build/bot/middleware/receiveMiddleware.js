'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _index = require('../controllers/index');

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// add receive middleware to controller
exports.default = function (controller) {

	controller.middleware.receive.use(_index.wit.receive);

	// get sent messages from Toki, in order to update dynamically
	controller.middleware.receive.use(getBotSentMessages);

	// middleware to handle the pausing of cron jobs
	// this middleware will turn off all existing work sessions
	// then add them to bot.queuedReachouts, which will be called
	// at the end of each conversation to turn back on
	controller.middleware.receive.use(pauseLiveWorkSessions);

	controller.middleware.receive.use(function (bot, message, next) {
		var type = message.type;
		var user = message.user;
		var bot_id = message.bot_id;

		var SlackUserId = message.user;

		if (!bot.onboardedUser) {
			bot.onboardedUser = {};
		}

		if (type && type == 'message' && user && !bot_id && !bot.onboardedUser[SlackUserId]) {
			console.log(bot.onboardedUser);
			console.log('\n\n\n reaching out to check if user onboarded. . . . \n\n\n');
			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {
				var onboarded = user.onboarded;

				if (!onboarded) {
					console.log('\n\n ~~ user has not onboarded yet ~~ \n\n');
					user.update({
						onboarded: true
					}).then(function () {
						controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
					});
				} else {
					next();
				}
			});
		}
	});
};

var pauseLiveWorkSessions = function pauseLiveWorkSessions(bot, message, next) {
	var bot_id = message.bot_id;
	var user = message.user;
	var channel = message.channel;


	if (!bot || !message) {
		console.log('~~ Weird bug where bot or message not found ~~\n:');
		console.log(bot);
		console.log(message);
		next();
		return;
	}

	var token = bot.config.token;

	bot = _index.bots[token]; // use same bot every time

	if (!bot.queuedReachouts) {
		bot.queuedReachouts = {};
	}

	if (message.user && message.type) {
		var botSlackUserId;
		var valid;

		(function () {

			// safeguard to prevent messages being sent by bot
			botSlackUserId = false;

			if (bot && bot.identity && bot.identity.id) {
				botSlackUserId = bot.identity.id;
			}

			var SlackUserId = message.user;

			// various safe measures against running pauseWorkSession functionality
			valid = true;

			if (typeof SlackUserId != "string") {
				console.log('SlackUserId is not a string: ' + SlackUserId);
				valid = false;
			} else if (botSlackUserId == SlackUserId) {
				console.log('This message is being sent by bot: ' + SlackUserId);
				valid = false;
			} else if (message.text && message.text[0] == "/") {
				console.log('This message is a slash command: `' + message.text + '`');
				valid = false;
			}

			if (message.type == "message" && message.text && valid) {

				console.log('\n ~~ this message affects pauseWorkSession middleware ~~ \n');

				// if found user, find the user
				_models2.default.User.find({
					where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
					include: [_models2.default.SlackUser]
				}).then(function (user) {

					if (user) {

						user.getWorkSessions({
							where: ['"live" = ?', true]
						}).then(function (workSessions) {

							// found a work session! (should be <= 1 per user)
							if (workSessions.length > 0) {

								var pausedWorkSessions = [];
								workSessions.forEach(function (workSession) {

									workSession.update({
										live: false
									});

									pausedWorkSessions.push(workSession);
								});

								// queued reachout has been created for this user
								if (bot.queuedReachouts[SlackUserId] && bot.queuedReachouts[SlackUserId].workSessions) {
									pausedWorkSessions.forEach(function (workSession) {
										bot.queuedReachouts[SlackUserId].workSessions.push(workSession);
									});
								} else {
									bot.queuedReachouts[SlackUserId] = {
										workSessions: pausedWorkSessions
									};
								}
							}

							next();
						});
					} else {
						next();
					}
				});
			} else {
				console.log('\n ~~ this event did not affect pause middleware ~~ \n');
				next();
			}
		})();
	}
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