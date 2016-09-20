import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';
import moment from 'moment-timezone';
import models from '../../app/models';

import storageCreator from '../lib/storage';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';

import notWitController from './notWit';
import miscController from './misc';
import sessionsController from './sessions';
import pingsController from './pings';
import slashController from './slash';
import dashboardController from './dashboard';

import { seedAndUpdateUsers } from '../../app/scripts';

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
		if (!err) {
			const { user, user: { id, team_id, name, tz } } = response;
			const email = user.profile && user.profile.email ? user.profile.email : '';
			models.User.find({
				where: { SlackUserId },
			})
			.then((user) => {
				if (!user) {
					models.User.create({
						TeamId: team_id,
						email,
						tz,
						SlackUserId,
						SlackName: name
					});
				} else {
					user.update({
						TeamId: team_id,
						SlackName: name
					})
				}
			});
		}
	});

});

/**
 * 		User has updated data ==> update our DB!
 */
controller.on('user_change', function (bot, message) {

	console.log("\n\n\n ~~ user updated profile ~~ \n\n\n");

	if (message && message.user) {

		const { user, user: { name, id, team_id, tz } } = message;

		const SlackUserId = id;
		const email       = user.profile && user.profile.email ? user.profile.email : '';

		models.User.find({
			where: { SlackUserId },
		})
		.then((user) => {
			if (!user) {
				models.User.create({
					TeamId: team_id,
					email,
					tz,
					SlackUserId,
					SlackName: name
				});
			} else {
				user.update({
					TeamId: team_id,
					SlackName: name
				})
			}
		});
	}

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

	notWitController(controller);
	dashboardController(controller);
	pingsController(controller);
	sessionsController(controller);
	slashController(controller);

	miscController(controller);

}

// try to avoid repeat RTM's
export function trackBot(bot) {
	bots[bot.config.token] = bot;
}

/**
 *      ***  TURN ON THE BOT  ****
 *         VIA SIGNUP OR LOGIN
 */

export function connectOnInstall(team_config) {

	console.log(`\n\n\n\n CONNECTING ON INSTALL \n\n\n\n`);

	let bot = controller.spawn(team_config);
	controller.trigger('create_bot', [bot, team_config]);
}

export function connectOnLogin(identity) {

	// bot already exists, get bot token for this users team
	var SlackUserId = identity.user_id;
	var TeamId      = identity.team_id;
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

controller.on('rtm_open',function(bot) {
  console.log(`\n\n\n\n** The RTM api just connected! for bot token: ${bot.config.token}\n\n\n`);
});

// upon install
controller.on('create_bot', (bot,team) => {

	const { id, url, name, bot: { token, user_id, createdBy, accessToken, scopes } } = team;

	// this is what is used to save team data
	const teamConfig = {
		TeamId: id,
		createdBy,
		url,
		name,
		token,
		scopes,
		accessToken
	}

	if (bots[bot.config.token]) {
		// already online! do nothing.
		console.log("already online! restarting bot due to re-install");
		// restart the bot
		bots[bot.config.token].closeRTM();

	}

	bot.startRTM((err) => {

		if (!err) {
			console.log("\n\n RTM on with team install and listening \n\n");
			trackBot(bot);
			controller.saveTeam(teamConfig, (err, id) => {
				if (err) {
					console.log("Error saving team")
				}
				else {
					console.log("Team " + team.name + " saved");
					console.log(`\n\n installing users... \n\n`);
					bot.api.users.list({}, (err, response) => {
						if (!err) {
							const { members } = response;
							seedAndUpdateUsers(members);
						}
						firstInstallInitiateConversation(bot, team);
					});
				}
			});
			
		} else {
			console.log("RTM failed")
		}
	});

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
				loginInitiateConversation(bot, identity);

			} else {
				console.log("RTM failed")
				console.log(err);
			}
		});
	}
});

