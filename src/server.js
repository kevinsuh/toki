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

var app = express();

// configuration 
dotenv.load();

// public folder for images, css,...
app.use('/assets', express.static(`${__dirname}/public`));

//parsing
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded

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
  console.log("\n\n ~~ In development server of Navi ~~ \n\n");
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
	 * 		~~ start up DA BOTS ~~
	 */
	teamTokens.forEach((token) => {
		var bot = controller.spawn({ token }).startRTM((err) => {
			if (err) {
				console.log('Error connecting to slack... :', err);
			} else {
				trackBot(bot); // avoid repeats
			}
		})
	})
});


controller.configureSlackApp({
	clientId: process.env.SLACK_ID,
	clientSecret: process.env.SLACK_SECRET,
	scopes: ['bot']
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
	console.log('listening on port ' + app.get('port'));

	 /**
	 * 						*** CRON JOB ***
	 * @param  time increment in cron format
	 * @param  function to run each increment
	 * @param  function to run at end of cron job
	 * @param  timezone of the job
	 */
	new CronJob('*/5 * * * * *', cronFunction, null, true, "America/New_York");
});


