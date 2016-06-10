// modules 
import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import dotenv from 'dotenv';

// CronJob
import cron from 'cron';
import cronFunction from './app/cron';
var CronJob = cron.CronJob;

// botkit
import { controller, customConfigBot } from './bot/controllers';

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

//port for Heroku
app.set('port', (process.env.PORT));

/**
 * 						*** CRON JOB ***
 * @param  time increment in cron format
 * @param  function to run each increment
 * @param  function to run at end of cron job
 * @param  timezone of the job
 */
new CronJob('* * * * *', cronFunction, null, true, "America/New_York");

// for dev purposes: every second
// new CronJob('* * * * * *', cronFunction, null, true, "America/New_York");


/**
 * 			START THE SERVER + BOT
 */
// ===================================================

customConfigBot(controller);
var bot = controller.spawn(({
	token: process.env.BOT_TOKEN
}));
export { bot };

app.listen(app.get('port'), () => {
  console.log('listening on port ' + app.get('port'));

	bot.startRTM((err) => {
	  if (!err) {
	    console.log("RTM on and listening");

	    bot.startPrivateConversation({user: "U121ZK15J"}, (err, convo) => {
	    	console.log("Convo object:");
	    	console.log(convo);
				// convo.say(`Hello Kevin. I am a bot that is hosted on your server now :robot_face:`);
			});
			// channels that start with "D" are direct message channels
			// bot.send({
   //      type: "message",
   //      channel: "D1F93BHM3",
   //      text: "hello world?"
   //  	});
	  } else {
	    console.log("RTM failed")
	  }
	});
  
});
