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

