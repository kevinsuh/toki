import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';

// config modules
import tasksController from './app/controllers/tasks';
import workSessionsController from './app/controllers/work_sessions';
import setupBot from './app/bot';
import setupReceiveMiddleware from './app/middleware/receiveMiddleware';
import miscellaneousController from './app/controllers/miscellaneousController';
require('dotenv').config();

// import the necessary things
import { customConfigBot } from './app/controllers';

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

