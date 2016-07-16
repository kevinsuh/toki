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

var _tasks = require('./tasks');

var _tasks2 = _interopRequireDefault(_tasks);

var _work_sessions = require('./work_sessions');

var _work_sessions2 = _interopRequireDefault(_work_sessions);

var _reminders = require('./reminders');

var _reminders2 = _interopRequireDefault(_reminders);

var _days = require('./days');

var _days2 = _interopRequireDefault(_days);

var _buttons = require('./buttons');

var _buttons2 = _interopRequireDefault(_buttons);

var _receiveMiddleware = require('../middleware/receiveMiddleware');

var _receiveMiddleware2 = _interopRequireDefault(_receiveMiddleware);

var _misc = require('./misc');

var _misc2 = _interopRequireDefault(_misc);

var _settings = require('./settings');

var _settings2 = _interopRequireDefault(_settings);

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

var _intents = require('../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

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
									TeamId: TeamId
								});
							} else {
								return _models2.default.SlackUser.create({
									UserId: UserId,
									SlackUserId: SlackUserId,
									TeamId: TeamId
								});
							}
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
	var queuedReachouts = bot.queuedReachouts;


	if (queuedReachouts && SlackUserId && queuedReachouts[SlackUserId]) {

		var queuedWorkSessions = queuedReachouts[SlackUserId].workSessions;

		console.log("\n\n ~~ looking to resume bot's queuedReachouts ~~:");

		if (queuedWorkSessions && queuedWorkSessions.length > 0) {

			var queuedWorkSessionIds = [];
			queuedWorkSessions.forEach(function (workSession) {
				var endTime = (0, _momentTimezone2.default)(workSession.endTime);
				if (endTime > now && workSession.dataValues.open == true) {
					console.log("resuming this queuedSession:");
					console.log(workSession);
					console.log("\n\n");
					queuedWorkSessionIds.push(workSession.dataValues.id);
				}
			});

			if (queuedWorkSessionIds.length > 0) {
				_models2.default.WorkSession.update({
					live: true
				}, {
					where: ['"WorkSessions"."id" IN (?) ', queuedWorkSessionIds]
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

	(0, _misc2.default)(controller);
	(0, _days2.default)(controller);
	(0, _tasks2.default)(controller);
	(0, _work_sessions2.default)(controller);
	(0, _reminders2.default)(controller);
	(0, _buttons2.default)(controller);
	(0, _settings2.default)(controller);
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

	// identity is the specific identiy of the logged in user
	/**
 		{ 
 			ok: true,
 			user: { name: 'Kevin Suh', id: 'U1LANQKHB' },
 			team: { id: 'T1LAWRR34' } 
 		}
  */

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

/**
 *      CATCH FOR WHETHER WE SHOULD START
 *        A NEW SESSION GROUP (AKA A NEW DAY) OR NOT
 *    1) if have not started day yet, then this will get triggered
 *    2) if it has been 5 hours, then this will get this trigger
 */
controller.on('new_session_group_decision', function (bot, config) {

	// type is either `ADD_TASK` or `START_SESSION`
	var SlackUserId = config.SlackUserId;
	var intent = config.intent;
	var message = config.message;


	_models2.default.User.find({
		where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
		include: [_models2.default.SlackUser]
	}).then(function (user) {

		var name = user.nickName || user.email;
		var UserId = user.id;

		// 1. has user started day yet?
		user.getSessionGroups({
			order: '"SessionGroup"."createdAt" DESC',
			limit: 1
		}).then(function (sessionGroups) {

			(0, _miscHelpers.consoleLog)("IN NEW SESSION GROUP DECISION", "this is the dispatch center for many decisions", "config object:", config);

			// 1. you have not started your day
			// you should start day and everything past this is irrelevant
			var shouldStartDay = false;
			if (sessionGroups.length == 0) {
				shouldStartDay = true;
			} else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
				shouldStartDay = true;
			}
			if (shouldStartDay) {
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("Wait, you have not started a day yet!");
					convo.next();
					convo.on('end', function (convo) {
						controller.trigger('user_confirm_new_day', [bot, { SlackUserId: SlackUserId }]);
					});
				});
				return;
			}

			// 2. you have already `started your day`, but it's been 5 hours since working with me
			user.getWorkSessions({
				where: ['"WorkSession"."endTime" > ?', _constants.startDayExpirationTime]
			}).then(function (workSessions) {

				// at this point you know the most recent SessionGroup is a `start_work`. has it been six hours since?
				var startDaySessionTime = (0, _momentTimezone2.default)(sessionGroups[0].createdAt);
				var now = (0, _momentTimezone2.default)();
				var hoursSinceStartDay = _momentTimezone2.default.duration(now.diff(startDaySessionTime)).asHours();

				// you have started your day or had work session in the last 6 hours
				// so we will pass you through and not have you start a new day
				if (hoursSinceStartDay < _constants.hoursForExpirationTime || workSessions.length > 0) {
					var config = {
						SlackUserId: SlackUserId,
						message: message,
						controller: controller,
						bot: bot
					};
					triggerIntent(intent, config);
					return;
				}

				// you have not had a work session in a while
				// so we will confirm this is what you want to do
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					convo.name = name;
					convo.newSessionGroup = {
						decision: false // for when you want to end early
					};

					convo.say('Hey ' + name + '! It\'s been a while since we worked together');
					convo.ask("If your priorities changed, I recommend that you `start your day` to kick the tires :car:, otherwise let's `continue`", function (response, convo) {

						var responseMessage = response.text;

						// 1. `start your day`
						// 2. `add a task`
						// 3. anything else will exit
						var startDay = new RegExp(/(((^st[tart]*))|(^d[ay]*))/); // `start` or `day`
						var letsContinue = new RegExp(/((^co[ntinue]*))/); // `add` or `task`

						if (startDay.test(responseMessage)) {
							// start new day
							convo.say("Got it. Let's do it! :weight_lifter:");
							convo.newSessionGroup.decision = _intents2.default.START_DAY;
						} else if (letsContinue.test(responseMessage)) {
							// continue with add task flow
							convo.newSessionGroup.decision = intent;
						} else {
							// default is to exit this conversation entirely
							convo.say("Okay! I'll be here for whenever you're ready");
						}
						convo.next();
					});

					convo.on('end', function (convo) {

						(0, _miscHelpers.consoleLog)("end of start new session group");

						var newSessionGroup = convo.newSessionGroup;


						if (newSessionGroup.decision == _intents2.default.START_DAY) {
							controller.trigger('begin_day_flow', [bot, { SlackUserId: SlackUserId }]);
							return;
						} else {
							var config = {
								SlackUserId: SlackUserId,
								message: message,
								controller: controller,
								bot: bot
							};
							triggerIntent(intent, config);
						}
					});
				});
			});
		});
	});
});

function triggerIntent(intent, config) {
	var bot = config.bot;
	var controller = config.controller;
	var SlackUserId = config.SlackUserId;
	var message = config.message;

	switch (intent) {
		case _intents2.default.ADD_TASK:
			controller.trigger('add_task_flow', [bot, { SlackUserId: SlackUserId, message: message }]);
			break;
		case _intents2.default.START_SESSION:
			controller.trigger('confirm_new_session', [bot, { SlackUserId: SlackUserId }]);
			break;
		case _intents2.default.VIEW_TASKS:
			controller.trigger('view_daily_tasks_flow', [bot, { SlackUserId: SlackUserId, message: message }]);
			break;
		case _intents2.default.EDIT_TASKS:
			controller.trigger('edit_tasks_flow', [bot, { SlackUserId: SlackUserId }]);
			break;
		case _intents2.default.END_DAY:
			controller.trigger('trigger_day_end', [bot, { SlackUserId: SlackUserId }]);
			break;
		default:
			resumeQueuedReachouts(bot, { SlackUserId: SlackUserId });
			break;
	}
}
//# sourceMappingURL=index.js.map