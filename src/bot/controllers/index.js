import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';
import moment from 'moment-timezone';

// config modules
import tasksController from './tasks';
import workSessionsController from './work_sessions';
import remindersController from './reminders';
import daysController from './days';
import buttonsController from './buttons';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';
import miscController from './misc';
import settingsController from './settings';
import slashController from './slash';
import notWitController from './notWit';

import models from '../../app/models';
import intentConfig from '../lib/intents';
import { colorsArray, THANK_YOU, hoursForExpirationTime, startDayExpirationTime } from '../lib/constants';
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

	miscController(controller);
	daysController(controller);
	tasksController(controller);
	workSessionsController(controller);
	remindersController(controller);
	buttonsController(controller);
	settingsController(controller);
	slashController(controller);

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


/**
 *      CATCH FOR WHETHER WE SHOULD START
 *        A NEW SESSION GROUP (AKA A NEW DAY) OR NOT
 *    1) if have not started day yet, then this will get triggered
 *    2) if it has been 5 hours, then this will get this trigger
 */
controller.on(`new_session_group_decision`, (bot, config) => {

	// type is either `ADD_TASK` or `START_SESSION`
	const { SlackUserId, intent, message, dailyTasksToWorkOn, taskDecision } = config;

	models.User.find({
		where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
		include: [ models.SlackUser ]
	})
	.then((user) => {

		var name     = user.nickName || user.email;
		const UserId = user.id;

		/**
		 *    ~~ THIS SKIPS EVERYTHING ELSE NOW ~~
		 *    	user is no longer required to have 
		 *    to start day, even though we encourage it
		 * 										07/19/16
		 */
		var config = {
			SlackUserId,
			message,
			controller,
			bot,
			dailyTasksToWorkOn,
			taskDecision
		}
		triggerIntent(intent, config);
		return;

		/**
		 * 		~~ END OF TEMPORARY SKIPPER INPUTTED CODE ~~
		 * 										07/19/16
		 */
		

		

		// 1. has user started day yet?
		user.getSessionGroups({
			order: `"SessionGroup"."createdAt" DESC`,
			limit: 1
		})
		.then((sessionGroups) => {

			consoleLog("IN NEW SESSION GROUP DECISION", "this is the dispatch center for many decisions", "config object:", config);

			// 1. you have not started your day
			// you should start day and everything past this is irrelevant
			var shouldStartDay = false;
			if (sessionGroups.length == 0) {
				shouldStartDay = true;
			} else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
				shouldStartDay = true;
			}
			if (shouldStartDay) {
				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
					convo.say("Wait, you have not started a day yet!");
					convo.next();
					convo.on('end', (convo) => {
						controller.trigger(`user_confirm_new_day`, [ bot, { SlackUserId }]);
					});
				});
				return;
			}

			// 2. you have already `started your day`, but it's been 5 hours since working with me
			user.getWorkSessions({
				where: [`"WorkSession"."endTime" > ?`, startDayExpirationTime]
			})
			.then((workSessions) => {

				// at this point you know the most recent SessionGroup is a `start_work`. has it been six hours since?
				var startDaySessionTime = moment(sessionGroups[0].createdAt);
				var now                 = moment();
				var hoursSinceStartDay  = moment.duration(now.diff(startDaySessionTime)).asHours();

				// you have started your day or had work session in the last 6 hours
				// so we will pass you through and not have you start a new day
				if (hoursSinceStartDay < hoursForExpirationTime || workSessions.length > 0) {
					var config = {
						SlackUserId,
						message,
						controller,
						bot,
						dailyTasksToWorkOn
					}
					triggerIntent(intent, config);
					return;
				}

				// you have not had a work session in a while
				// so we will confirm this is what you want to do
				bot.startPrivateConversation ({ user: SlackUserId }, (err, convo) => {

					convo.name = name;
					convo.newSessionGroup = {
						decision: false // for when you want to end early
					};

					convo.say(`Hey ${name}! It's been a while since we worked together`);
					convo.ask("If your priorities changed, I recommend that you `start your day` to kick the tires :car:, otherwise let's `continue`", (response, convo) => {

						var responseMessage = response.text;

						// 1. `start your day`
						// 2. `add a task`
						// 3. anything else will exit
						var startDay = new RegExp(/(((^st[tart]*))|(^d[ay]*))/); // `start` or `day`
						var letsContinue = new RegExp(/((^co[ntinue]*))/); // `add` or `task`

						if (startDay.test(responseMessage)) {
							// start new day
							convo.say("Got it. Let's do it! :weight_lifter:");
							convo.newSessionGroup.decision = intentConfig.START_DAY;
						} else if (letsContinue.test(responseMessage)) {
							// continue with add task flow
							convo.newSessionGroup.decision = intent;
						} else {
							// default is to exit this conversation entirely
							convo.say("Okay! I'll be here for whenever you're ready");
						}
						convo.next();
					});

					
					convo.on('end', (convo) => {

						consoleLog("end of start new session group");

						const { newSessionGroup } = convo;

						if (newSessionGroup.decision == intentConfig.START_DAY) {
							controller.trigger(`begin_day_flow`, [ bot, { SlackUserId }]);
							return;
						} else {
							var config = {
								SlackUserId,
								message,
								controller,
								bot,
								dailyTasksToWorkOn,
								taskDecision
							}
							triggerIntent(intent, config);
						}

					});

				});
			});
		});
	});
});

export function triggerIntent(intent, config) {
	const { bot, controller, SlackUserId, message, dailyTasksToWorkOn } = config;
	switch (intent) {
		case intentConfig.ADD_TASK:
			controller.trigger(`edit_tasks_flow`, [ bot, { SlackUserId, message }]);
			break;
		case intentConfig.START_SESSION:
		console.log(config);
			controller.trigger(`edit_tasks_flow`, [ bot, config ]);
			break;
		case intentConfig.VIEW_TASKS:
			controller.trigger(`view_daily_tasks_flow`, [ bot, { SlackUserId, message } ]);
			break;
		case intentConfig.EDIT_TASKS:
			controller.trigger(`edit_tasks_flow`, [ bot, { SlackUserId } ]);
			break;
		case intentConfig.END_DAY:
			controller.trigger(`trigger_day_end`, [ bot, { SlackUserId } ]);
			break;
		default: 
			resumeQueuedReachouts(bot, { SlackUserId });
			break;
	}
}

