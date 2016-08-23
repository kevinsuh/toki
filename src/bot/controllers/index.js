import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';
import moment from 'moment-timezone';
import models from '../../app/models';

import storageCreator from '../lib/storage';

require('dotenv').config();

var env = process.env.NODE_ENV || 'development';
if (env == 'development') {
	process.env.SLACK_ID = process.env.DEV_SLACK_ID;
	process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
}

// actions
import { firstInstallInitiateConversation, loginInitiateConversation } from '../actions';

// Wit Brain
if (process.env.WIT_TOKEN) {

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
	});

});

// simple way to keep track of bots
export var bots = {};

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.HTTP_PORT) {
	console.log('Error: Specify SLACK_ID SLACK_SECRET and HTTP_PORT in environment');
	process.exit(1);
}

// Custom Toki Config
export function customConfigBot(controller) {

	// beef up the bot
	setupReceiveMiddleware(controller);

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

