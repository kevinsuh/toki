'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.bots = exports.controller = exports.wit = undefined;
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

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

var _storage = require('../lib/storage');

var _storage2 = _interopRequireDefault(_storage);

var _actions = require('../actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

require('dotenv').config();

var env = process.env.NODE_ENV || 'development';
if (env == 'development') {
	consoleLog("In development controller of Toki");
	process.env.SLACK_ID = process.env.DEV_SLACK_ID;
	process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
}

// actions


// Wit Brain
if (process.env.WIT_TOKEN) {

	consoleLog("Integrate Wit");
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

	bot.api.users.info({ user: SlackUserId }, function (err, response) {});
});

// simple way to keep track of bots
var bots = exports.bots = {};

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.HTTP_PORT) {
	console.log('Error: Specify SLACK_ID SLACK_SECRET and HTTP_PORT in environment');
	process.exit(1);
}

// Custom Toki Config
function customConfigBot(controller) {

	// beef up the bot
	setupReceiveMiddleware(controller);
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
				(0, _actions.firstInstallInitiateConversation)(bot, team);
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
		(0, _actions.loginInitiateConversation)(bot, identity);
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
				(0, _actions.loginInitiateConversation)(bot, identity);
			} else {
				console.log("RTM failed");
				console.log(err);
			}
		});
	}
});
//# sourceMappingURL=index.js.map