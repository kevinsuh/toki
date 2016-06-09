import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';

// config modules
import tasksController from './bot/controllers/tasks';
import workSessionsController from './bot/controllers/work_sessions';
import setupBot from './bot/bot';
import setupReceiveMiddleware from './bot/middleware/receiveMiddleware';
import miscellaneousController from './bot/controllers/miscellaneousController';
require('dotenv').config();

// import the necessary things
import { customConfigBot } from './bot/controllers';

var controller = Botkit.slackbot();

var bot = controller.spawn({
    token: process.env.SLACK_DEV_TOKEN
});

bot.startRTM((err) => {
  if (!err) {
    console.log("RTM on and listening");
    customConfigBot(controller);
  } else {
    console.log("RTM failed")
  }
});

/**
 * 		experimenting around with pg
 */

// import pg from 'pg';
// var connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/todo';

// var client = new pg.Client(connectionString);
// client.connect();
// var query = client.query('CREATE TABLE items(id SERIAL PRIMARY KEY, text VARCHAR(40) not null, complete BOOLEAN)');
// query.on('end', function() { client.end(); });



