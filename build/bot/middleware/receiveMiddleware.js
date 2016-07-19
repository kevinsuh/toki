'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

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

		if (message.user && message.type) {
			var _ret = function () {

				var SlackUserId = message.user;
				// another safe measure
				if (typeof SlackUserId != "string") {
					console.log('SlackUserId is not a string: ' + SlackUserId);
					next();
					return {
						v: void 0
					};
				}

				if (message.type == "message" && message.text) {

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
			}();

			if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
		}
	});
};
//# sourceMappingURL=receiveMiddleware.js.map