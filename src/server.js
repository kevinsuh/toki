// modules 
import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';

// CronJob
import cron from 'cron';
import cronFunction from './app/cron';
var CronJob = cron.CronJob;

import { seedUsers, updateUsers, test } from './app/scripts';
import { consoleLog, prioritizeDailyTasks } from './bot/lib/miscHelpers';
import './app/globalHelpers';

setTimeout(() => {
	consoleLog("updating and seeding users");
	// updateUsers(); // to fill in all users who are not in DB yet
	seedUsers();
}, 5000)

var app = express();

// configuration 
dotenv.load();

// public folder for images, css,...
app.use('/assets', express.static(`${__dirname}/public`));

//parsing
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded

// include bootstrap and jQuery
app.use('/js', express.static(`${__dirname}/../node_modules/bootstrap/dist/js`));
app.use('/js', express.static(`${__dirname}/../node_modules/jquery/dist`));
app.use('/css', express.static(`${__dirname}/../node_modules/bootstrap/dist/css`));
app.use('/fonts', express.static(`${__dirname}/../node_modules/bootstrap/dist/fonts`));

// view engine ejs
app.set('view engine', 'ejs');

// routes
require('./app/router').default((app));

// Error Handling
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
});

var env = process.env.NODE_ENV || 'development';
if (env == 'development') {
	consoleLog("In development server of Toki");
  process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
  process.env.SLACK_ID = process.env.DEV_SLACK_ID;
	process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;

}

/**
 * 			START THE SERVER + BOT
 */
// ===================================================

// botkit
import { controller, customConfigBot, trackBot } from './bot/controllers';

customConfigBot(controller);

controller.configureSlackApp({
	clientId: process.env.SLACK_ID,
	clientSecret: process.env.SLACK_SECRET,
	scopes: ['bot', 'commands']
})
controller.createWebhookEndpoints(app);
controller.createOauthEndpoints(app,function(err,req,res) {
  if (err) {
    res.status(500).send('ERROR: ' + err);
  } else {
    res.send('Success!');
  }
});

// create HTTP service
http.createServer(app).listen(process.env.HTTP_PORT, () => {
	consoleLog(`Listening on port: ${app.get('port')}`);

	 /**
	 * 						*** CRON JOB ***
	 * @param  time increment in cron format
	 * @param  function to run each increment
	 * @param  function to run at end of cron job
	 * @param  timezone of the job
	 */
	new CronJob('*/5 * * * * *', cronFunction, null, true, "America/New_York");

	// add bot to each team
	var teamTokens = [];
	controller.storage.teams.all((err, teams) => {
		if (err) {
			throw new Error(err);
		}

		// connect all the teams with bots up to slack
		for (var t in teams) {
			if (teams[t]) {
				teamTokens.push(teams[t].token);
			}
		}

		/**
		 * 		~~ START UP ZE BOTS ~~
		 */
		teamTokens.forEach((token) => {
			var bot = controller.spawn({ token }).startRTM((err) => {
				if (err) {
					consoleLog(`'Error connecting to slack... :' ${err}`);
				} else {
					if (token == process.env.BOT_TOKEN && process.env.KEVIN_SLACK_USER_ID) {
						bot.startPrivateConversation({user: process.env.KEVIN_SLACK_USER_ID}, (err, convo) => {
							convo.say("Good morning Kevin, I'm ready for you :robot_face:");
						})
						if (env == "production" && process.env.CHIP_SLACK_USER_ID) {
							bot.startPrivateConversation({ user: process.env.CHIP_SLACK_USER_ID}, (err, convo) => {
								convo.say("Hello Chip, I'm ready for you :robot_face:");
							})
						}
					}
					trackBot(bot); // this is where we store all ze bots
				}
			})
		});
	});
});


