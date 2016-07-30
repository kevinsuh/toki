import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';
import moment from 'moment-timezone';

// config modules
import remindersController from './reminders';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';
import miscController from './misc';
import settingsController from './settings';
import notWitController from './notWit';
import onboardController from './onboard';
import buttonsController from './buttons';

import models from '../../app/models';
import { colorsArray, hoursForExpirationTime, startDayExpirationTime } from '../lib/constants';
import { consoleLog } from '../lib/miscHelpers';

import storageCreator from '../lib/storage';

require('dotenv').config();

var env = process.env.NODE_ENV || 'development';
if (env == 'development') {
	consoleLog("In development controller of Toki");
	process.env.SLACK_ID = process.env.DEV_SLACK_ID;
	process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
}

// actions
import { firstInstallInitiateConversation, loginInitiateConversation } from '../actions/initiation';

// Wit Brain
if (process.env.WIT_TOKEN) {

	consoleLog("Integrate Wit");
	var wit = Wit({
		token: process.env.WIT_TOKEN,
		minimum_confidence: 0.55
	});
	
} else {
	console.log('Error: Specify WIT_TOKEN in environment');
	process.exit(1);
}

export { wit };

/**
 *      ***  CONFIG  ****
 */

var config = {};
const storage = storageCreator(config);
var controller = Botkit.slackbot({
	interactive_replies: true,
	storage
});
export { controller };

/**
 * 		User has joined slack channel ==> make connection
 * 		then onboard!
 */
controller.on('team_join', function (bot, message) {
	console.log("\n\n\n ~~ joined the team ~~ \n\n\n");
	const SlackUserId = message.user.id;

	console.log(message.user.id);

	bot.api.users.info({ user: SlackUserId }, (err, response) => {

		if (response.ok) {

			const nickName = response.user.name;
			const email    = response.user.profile.email;
			const TeamId   = response.user.team_id;

			if (email) {

				// create SlackUser to attach to user
				models.User.find({
					where: { email: email },
					include: [ models.SlackUser ]
				})
				.then((user) => {
					
					if (user) {
						user.update({
							nickName
						});
						const UserId = user.id;
						if (user.SlackUser) {
							return user.SlackUser.update({
								UserId,
								SlackUserId,
								TeamId
							});
						} else {
							return models.SlackUser.create({
								UserId,
								SlackUserId,
								TeamId
							});
						}
					}
				})
				.then((slackUser) => {
					controller.trigger('begin_onboard_flow', [ bot, { SlackUserId } ]);
				})
			}
		}

	});
});

// simple way to keep track of bots
export var bots = {};

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.HTTP_PORT) {
	console.log('Error: Specify SLACK_ID SLACK_SECRET and HTTP_PORT in environment');
	process.exit(1);
}

/**
 * 		The master controller to handle all double conversations
 * 		This function is what turns back on the necessary functions
 */
export function resumeQueuedReachouts(bot, config) {

	// necessary config
	var now                 = moment();
	var { SlackUserId }     = config;

	const { token } = bot.config;
	bot             = bots[token]; // use same bot every time

	var { queuedReachouts } = bot;

	if (queuedReachouts && SlackUserId && queuedReachouts[SlackUserId]) {

		var queuedWorkSessions = queuedReachouts[SlackUserId].workSessions;

		if (queuedWorkSessions && queuedWorkSessions.length > 0) {

			var queuedWorkSessionIds = [];
			queuedWorkSessions.forEach((workSession) => {
				var endTime = moment(workSession.endTime);
				let tenMinuteBuffer = now.subtract(10, 'minutes');
				if (endTime > tenMinuteBuffer && workSession.dataValues.open == true) {
					if (workSession.dataValues) {
						console.log(`resuming this queuedSession: ${workSession.dataValues.id}`);
					}
					queuedWorkSessionIds.push(workSession.dataValues.id);
				}
			})

			console.log("\n\n ~~ resuming the queued reachouts ~~");
			console.log(queuedWorkSessionIds);
			console.log("\n\n");

			if (queuedWorkSessionIds.length > 0) {

				// if storedWorkSessionId IS NULL, means it has not been
				// intentionally paused intentionally be user!
				models.WorkSession.findAll({
					where: [`"WorkSession"."id" IN (?) AND "StoredWorkSession"."id" IS NULL`, queuedWorkSessionIds],
					include: [ models.StoredWorkSession ]
				})
				.then((workSessions) => {
					workSessions.forEach((workSession) => {
						workSession.updateAttributes({
							live: true
						});
					})
				});

			}

		}

		// "popping our queue" for the user
		bot.queuedReachouts[SlackUserId].workSessions = [];
		
	}
}

// Custom Toki Config
export function customConfigBot(controller) {

	// beef up the bot
	setupReceiveMiddleware(controller);

	// give non-wit a chance to answer first
	notWitController(controller);

	onboardController(controller);
	remindersController(controller);
	settingsController(controller);
	buttonsController(controller);

	// last because miscController will hold fallbacks
	miscController(controller);

}

// try to avoid repeat RTM's
export function trackBot(bot, token) {
	bots[bot.config.token] = bot;
}

/**
 *      ***  TURN ON THE BOT  ****
 *         VIA SIGNUP OR LOGIN
 */

export function connectOnInstall(team_config) {
	var bot = controller.spawn(team_config);
	controller.trigger('create_bot', [bot, team_config]);
}

export function connectOnLogin(identity) {

	// bot already exists, get bot token for this users team
	var SlackUserId = identity.user.id;
	var TeamId      = identity.team.id;
	models.Team.find({
		where: { TeamId }
	})
	.then((team) => {
		const { token } = team;

		if (token) {
			var bot = controller.spawn({ token });
			controller.trigger('login_bot', [bot, identity]);
		}

	})
}

// upon install
controller.on('create_bot', (bot,team) => {

	if (bots[bot.config.token]) {
		// already online! do nothing.
		console.log("already online! do nothing.")
	} else {
		bot.startRTM((err) => {
			if (!err) {
				console.log("RTM on and listening");
				customConfigBot(controller);
				trackBot(bot);
				controller.saveTeam(team, (err, id) => {
					if (err) {
						console.log("Error saving team")
					}
					else {
						console.log("Team " + team.name + " saved")
					}
				})
				firstInstallInitiateConversation(bot, team);
			} else {
				console.log("RTM failed")
			}
		});
	}
});

// subsequent logins
controller.on('login_bot', (bot,identity) => {

	if (bots[bot.config.token]) {
		// already online! do nothing.
		console.log("already online! do nothing.");
		loginInitiateConversation(bot, identity);
	} else {
		bot.startRTM((err) => {
			if (!err) {

				console.log("RTM on and listening");
				trackBot(bot);
				controller.saveTeam(team, (err, team) => {
					if (err) {
						console.log("Error saving team")
					}
					else {
						console.log("Team " + team.name + " saved")
					}
				});
				loginInitiateConversation(bot, identity);
			} else {
				console.log("RTM failed")
				console.log(err);
			}
		});
	}
});

