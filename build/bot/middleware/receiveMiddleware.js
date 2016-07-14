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

	// middleware to handle the pausing of cron jobs
	// this middleware will turn off all existing work sessions
	// then add them to bot.queuedReachouts, which will be called
	// at the end of each conversation to turn back on
	controller.middleware.receive.use(function (bot, message, next) {

		if (!bot.queuedReachouts) {
			bot.queuedReachouts = {};
		}

		if (message.user) {
			(function () {

				var SlackUserId = message.user;

				// if found user, find the user
				_models2.default.User.find({
					where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
					include: [_models2.default.SlackUser]
				}).then(function (user) {

					if (user) {

						user.getWorkSessions({
							where: ['"open" = ? AND "live" = ?', true, true]
						}).then(function (workSessions) {

							// found a work session! (should be <= 1 per user)
							if (workSessions.length > 0) {

								// make sure to not queue up more than 1 of the same workSession
								var existingPausedWorkSessionIds = [];
								if (bot.queuedReachouts[SlackUserId] && bot.queuedReachouts[SlackUserId].workSessions) {
									existingPausedWorkSessionIds = bot.queuedReachouts[SlackUserId].workSessions.map(function (workSession) {
										return workSession.dataValues.id;
									});
								}

								var pausedWorkSessions = [];
								workSessions.forEach(function (workSession) {

									workSession.update({
										live: false,
										open: false
									});

									// make sure it is not already queued to add to
									// bot.queuedReachouts
									if (existingPausedWorkSessionIds.indexOf(workSession.dataValues.id) < 0) {
										pausedWorkSessions.push(workSession);
									}
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
			})();
		} else {
			next();
		}
	});
};
//# sourceMappingURL=receiveMiddleware.js.map