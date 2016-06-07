/*
# TO RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node slack_bot.js
*/

import Botkit from 'botkit';
import os from 'os';
import tasksController from './controllers/tasks';
import setupBot from './bot';
import setupReceiveMiddleware from './middleware/receiveMiddleware';

// THIS MUST BE TAKEN OUT WHEN IN PRODUCTION
var token = `xoxb-48507738372-KwxgAW6WrQN2tG0S61619R1F`; // this is token to navi_bot specifically
// THIS MUST BE TAKEN OUT WHEN IN PRODUCTION
var witToken = `HY7IVXF32KXPA6VBNZEC5C7O6R2ATPX4`;

/**
 *      INTEGRATE WIT BRAIN
 */

import Wit from 'botkit-middleware-witai';
var wit = Wit({
    token: witToken,
    minimum_confidence: 0.55
});
export { wit };

/**
 *      SET UP NAVI TO RUN
 */
var controller = Botkit.slackbot();

/**
 *      CONTROLLER FUNCTIONS
 */
var bot = controller.spawn({
    token
});

bot.startRTM((err, bot, payload) => {
    console.log("RTM Connection finished! Bot is now on and listening");
});

/**
 *      BEEF UP NAVI BOT
 */
setupBot(bot);
setupReceiveMiddleware(controller);

/**
 *      SET UP NAVI'S CONTROLLERS
 */
tasksController(controller);

