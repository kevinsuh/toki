'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.bots = exports.controller = exports.wit = undefined;
exports.resumeQueuedReachouts = resumeQueuedReachouts;
exports.customConfigBot = customConfigBot;
exports.trackBot = trackBot;
exports.connectOnInstall = connectOnInstall;
exports.connectOnLogin = connectOnLogin;

var _botkit = require('botkit');

var _botkit2 = _interopRequireDefault(_botkit);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _botkitMiddlewareWitai = require('botkit-middleware-witai');

var _botkitMiddlewareWitai2 = _interopRequireDefault(_botkitMiddlewareWitai);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _reminders = require('./reminders');

var _reminders2 = _interopRequireDefault(_reminders);

var _receiveMiddleware = require('../middleware/receiveMiddleware');

var _receiveMiddleware2 = _interopRequireDefault(_receiveMiddleware);

var _misc = require('./misc');

var _misc2 = _interopRequireDefault(_misc);

var _settings = require('./settings');

var _settings2 = _interopRequireDefault(_settings);

var _notWit = require('./notWit');

var _notWit2 = _interopRequireDefault(_notWit);

var _onboard = require('./onboard');

var _onboard2 = _interopRequireDefault(_onboard);

var _buttons = require('./buttons');

var _buttons2 = _interopRequireDefault(_buttons);

var _plans = require('./plans');

var _plans2 = _interopRequireDefault(_plans);

var _work_sessions = require('./work_sessions');

var _work_sessions2 = _interopRequireDefault(_work_sessions);

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../lib/constants');

var _miscHelpers = require('../lib/miscHelpers');

var _storage = require('../lib/storage');

var _storage2 = _interopRequireDefault(_storage);

var _initiation = require('../actions/initiation');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

require('dotenv').config();

// config modules


var env = process.env.NODE_ENV || 'development';
if (env == 'development') {
	(0, _miscHelpers.consoleLog)("In development controller of Toki");
	process.env.SLACK_ID = process.env.DEV_SLACK_ID;
	process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
}

// actions


// Wit Brain
if (process.env.WIT_TOKEN) {

	(0, _miscHelpers.consoleLog)("Integrate Wit");
	var wit = (0, _botkitMiddlewareWitai2.default)({
		token: process.env.WIT_TOKEN,
		minimum_confidence: 0.55
	});
} else {
	console.log('Error: Specify WIT_TOKEN in environment');
	process.exit(1);
}

exports.wit = wit;

/**
 *      ***  CONFIG  ****
 */

var config = {};
var storage = (0, _storage2.default)(config);
var controller = _botkit2.default.slackbot({
	interactive_replies: true,
	storage: storage
});
exports.controller = controller;

/**
 * 		User has joined slack channel ==> make connection
 * 		then onboard!
 */

controller.on('team_join', function (bot, message) {
	console.log("\n\n\n ~~ joined the team ~~ \n\n\n");
	var SlackUserId = message.user.id;

	console.log(message.user.id);

	bot.api.users.info({ user: SlackUserId }, function (err, response) {

		if (response.ok) {
			(function () {

				var nickName = response.user.name;
				var email = response.user.profile.email;
				var TeamId = response.user.team_id;

				if (email) {

					// create SlackUser to attach to user
					_models2.default.User.find({
						where: { email: email },
						include: [_models2.default.SlackUser]
					}).then(function (user) {

						if (user) {
							user.update({
								nickName: nickName
							});
							var UserId = user.id;
							if (user.SlackUser) {
								return user.SlackUser.update({
									UserId: UserId,
									SlackUserId: SlackUserId,
									SlackName: nickName,
									TeamId: TeamId
								});
							} else {
								return _models2.default.SlackUser.create({
									UserId: UserId,
									SlackUserId: SlackUserId,
									SlackName: nickName,
									TeamId: TeamId
								});
							}
						} else {
							_models2.default.User.create({
								email: email,
								nickName: nickName
							}).then(function (user) {
								var UserId = user.id;
								return user.SlackUser.create({
									UserId: UserId,
									SlackUserId: SlackUserId,
									TeamId: TeamId,
									SlackName: nickName
								});
							});
						}
					}).then(function (slackUser) {
						controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
					});
				}
			})();
		}
	});
});

// simple way to keep track of bots
var bots = exports.bots = {};

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.HTTP_PORT) {
	console.log('Error: Specify SLACK_ID SLACK_SECRET and HTTP_PORT in environment');
	process.exit(1);
}

/**
 * 		The master controller to handle all double conversations
 * 		This function is what turns back on the necessary functions
 */
function resumeQueuedReachouts(bot, config) {

	// necessary config
	var now = (0, _momentTimezone2.default)();
	var SlackUserId = config.SlackUserId;
	var token = bot.config.token;

	bot = bots[token]; // use same bot every time

	var _bot = bot;
	var queuedReachouts = _bot.queuedReachouts;


	if (queuedReachouts && SlackUserId && queuedReachouts[SlackUserId]) {

		var queuedWorkSessions = queuedReachouts[SlackUserId].workSessions;

		if (queuedWorkSessions && queuedWorkSessions.length > 0) {

			var queuedWorkSessionIds = [];
			queuedWorkSessions.forEach(function (workSession) {
				var endTime = (0, _momentTimezone2.default)(workSession.endTime);
				var tenMinuteBuffer = now.subtract(10, 'minutes');
				if (endTime > tenMinuteBuffer && workSession.dataValues.open == true) {
					if (workSession.dataValues) {
						console.log('resuming this queuedSession: ' + workSession.dataValues.id);
					}
					queuedWorkSessionIds.push(workSession.dataValues.id);
				}
			});

			console.log("\n\n ~~ resuming the queued reachouts ~~");
			console.log(queuedWorkSessionIds);
			console.log("\n\n");

			if (queuedWorkSessionIds.length > 0) {

				// if storedWorkSessionId IS NULL, means it has not been
				// intentionally paused intentionally be user!
				_models2.default.WorkSession.findAll({
					where: ['"WorkSession"."id" IN (?) AND "StoredWorkSession"."id" IS NULL', queuedWorkSessionIds],
					include: [_models2.default.StoredWorkSession]
				}).then(function (workSessions) {
					workSessions.forEach(function (workSession) {
						workSession.updateAttributes({
							live: true
						});
					});
				});
			}
		}

		// "popping our queue" for the user
		bot.queuedReachouts[SlackUserId].workSessions = [];
	}
}

// Custom Toki Config
function customConfigBot(controller) {

	// beef up the bot
	(0, _receiveMiddleware2.default)(controller);

	// give non-wit a chance to answer first
	(0, _notWit2.default)(controller);

	(0, _onboard2.default)(controller);
	(0, _reminders2.default)(controller);
	(0, _settings2.default)(controller);
	(0, _buttons2.default)(controller);
	(0, _plans2.default)(controller);
	(0, _work_sessions2.default)(controller);

	// last because miscController will hold fallbacks
	(0, _misc2.default)(controller);
}

// try to avoid repeat RTM's
function trackBot(bot, token) {
	bots[bot.config.token] = bot;
}

/**
 *      ***  TURN ON THE BOT  ****
 *         VIA SIGNUP OR LOGIN
 */

function connectOnInstall(team_config) {
	var bot = controller.spawn(team_config);
	controller.trigger('create_bot', [bot, team_config]);
}

function connectOnLogin(identity) {

	// bot already exists, get bot token for this users team
	var SlackUserId = identity.user.id;
	var TeamId = identity.team.id;
	_models2.default.Team.find({
		where: { TeamId: TeamId }
	}).then(function (team) {
		var token = team.token;


		if (token) {
			var bot = controller.spawn({ token: token });
			controller.trigger('login_bot', [bot, identity]);
		}
	});
}

// upon install
controller.on('create_bot', function (bot, team) {

	if (bots[bot.config.token]) {
		// already online! do nothing.
		console.log("already online! do nothing.");
	} else {
		bot.startRTM(function (err) {
			if (!err) {
				console.log("RTM on and listening");
				customConfigBot(controller);
				trackBot(bot);
				controller.saveTeam(team, function (err, id) {
					if (err) {
						console.log("Error saving team");
					} else {
						console.log("Team " + team.name + " saved");
					}
				});
				(0, _initiation.firstInstallInitiateConversation)(bot, team);
			} else {
				console.log("RTM failed");
			}
		});
	}
});

// subsequent logins
controller.on('login_bot', function (bot, identity) {

	if (bots[bot.config.token]) {
		// already online! do nothing.
		console.log("already online! do nothing.");
		(0, _initiation.loginInitiateConversation)(bot, identity);
	} else {
		bot.startRTM(function (err) {
			if (!err) {

				console.log("RTM on and listening");
				trackBot(bot);
				controller.saveTeam(team, function (err, team) {
					if (err) {
						console.log("Error saving team");
					} else {
						console.log("Team " + team.name + " saved");
					}
				});
				(0, _initiation.loginInitiateConversation)(bot, identity);
			} else {
				console.log("RTM failed");
				console.log(err);
			}
		});
	}
});
//# sourceMappingURL=index.js.map