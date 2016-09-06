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

var _receiveMiddleware = require('../middleware/receiveMiddleware');

var _receiveMiddleware2 = _interopRequireDefault(_receiveMiddleware);

var _notWit = require('./notWit');

var _notWit2 = _interopRequireDefault(_notWit);

var _misc = require('./misc');

var _misc2 = _interopRequireDefault(_misc);

var _sessions = require('./sessions');

var _sessions2 = _interopRequireDefault(_sessions);

var _pings = require('./pings');

var _pings2 = _interopRequireDefault(_pings);

var _slash = require('./slash');

var _slash2 = _interopRequireDefault(_slash);

var _scripts = require('../../app/scripts');

var _actions = require('../actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

require('dotenv').config();

var env = process.env.NODE_ENV || 'development';
if (env == 'development') {
	process.env.SLACK_ID = process.env.DEV_SLACK_ID;
	process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
}

// actions


// Wit Brain
if (process.env.WIT_TOKEN) {

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
		if (!err) {
			(function () {
				var user = response.user;
				var _response$user = response.user;
				var id = _response$user.id;
				var team_id = _response$user.team_id;
				var name = _response$user.name;
				var tz = _response$user.tz;

				var email = user.profile && user.profile.email ? user.profile.email : '';
				_models2.default.User.find({
					where: { SlackUserId: SlackUserId }
				}).then(function (user) {
					if (!user) {
						_models2.default.User.create({
							TeamId: team_id,
							email: email,
							tz: tz,
							SlackUserId: SlackUserId,
							SlackName: name
						});
					} else {
						user.update({
							TeamId: team_id,
							SlackName: name
						});
					}
				});
			})();
		}
	});
});

/**
 * 		User has updated data ==> update our DB!
 */
controller.on('user_change', function (bot, message) {

	console.log("\n\n\n ~~ user updated profile ~~ \n\n\n");

	if (message && message.user) {
		(function () {
			var user = message.user;
			var _message$user = message.user;
			var name = _message$user.name;
			var id = _message$user.id;
			var team_id = _message$user.team_id;
			var tz = _message$user.tz;


			var SlackUserId = id;
			var email = user.profile && user.profile.email ? user.profile.email : '';

			_models2.default.User.find({
				where: { SlackUserId: SlackUserId }
			}).then(function (user) {
				if (!user) {
					_models2.default.User.create({
						TeamId: team_id,
						email: email,
						tz: tz,
						SlackUserId: SlackUserId,
						SlackName: name
					});
				} else {
					user.update({
						TeamId: team_id,
						SlackName: name
					});
				}
			});
		})();
	}
});

// join a channel
controller.on('channel_joined', function (bot, message) {
	console.log('\n\n\n yo joined the channel:');
	console.log(message);
});

controller.on('reaction_added', function (bot, message) {

	console.log('\n\n yo reaction added:');
	console.log(message);
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
	(0, _receiveMiddleware2.default)(controller);

	(0, _notWit2.default)(controller);
	(0, _pings2.default)(controller);
	(0, _sessions2.default)(controller);
	(0, _slash2.default)(controller);

	(0, _misc2.default)(controller);
}

// try to avoid repeat RTM's
function trackBot(bot) {

	console.log('\n\n\n\n\n\n ~~ token: ' + bot.config.token + ' \n\n\n\n\n');

	bots[bot.config.token] = bot;
}

/**
 *      ***  TURN ON THE BOT  ****
 *         VIA SIGNUP OR LOGIN
 */

function connectOnInstall(team_config) {

	console.log('\n\n\n\n CONNECTING ON INSTALL \n\n\n\n');

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

controller.on('rtm_open', function (bot) {
	console.log('\n\n\n\n** The RTM api just connected! for bot token: ' + bot.config.token + '\n\n\n');
});

// upon install
controller.on('create_bot', function (bot, team) {

	if (bots[bot.config.token]) {
		// already online! do nothing.
		console.log("already online! updating bot...");

		var id = team.id;
		var _team$bot = team.bot;
		var token = _team$bot.token;
		var user_id = _team$bot.user_id;
		var createdBy = _team$bot.createdBy;


		_models2.default.Team.update({
			createdBy: createdBy,
			token: token
		}, {
			where: { TeamId: id }
		}).then(function () {

			// restart the bot
			bots[bot.config.token].closeRTM();
			bots[bot.config.token] = bot;
			bot.startRTM(function (err) {
				if (!err) {
					console.log("\n\n RTM on with team install and listening \n\n");
					trackBot(bot);
					controller.saveTeam(team, function (err, id) {
						if (err) {
							console.log("Error saving team");
						} else {
							console.log("Team " + team.name + " saved");
							console.log('\n\n installing users... \n\n');
							bot.api.users.list({}, function (err, response) {
								if (!err) {
									var members = response.members;

									(0, _scripts.seedAndUpdateUsers)(members);
								}
								(0, _actions.firstInstallInitiateConversation)(bot, team);
							});
						}
					});
				} else {
					console.log("RTM failed");
				}
			});
		});
	} else {

		bot.startRTM(function (err) {
			if (!err) {
				console.log("\n\n RTM on with team install and listening \n\n");
				trackBot(bot);
				controller.saveTeam(team, function (err, id) {
					if (err) {
						console.log("Error saving team");
					} else {
						console.log("Team " + team.name + " saved");
						console.log('\n\n installing users... \n\n');
						bot.api.users.list({}, function (err, response) {
							if (!err) {
								var members = response.members;

								(0, _scripts.seedAndUpdateUsers)(members);
							}
							(0, _actions.firstInstallInitiateConversation)(bot, team);
						});
					}
				});
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