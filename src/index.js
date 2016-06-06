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

// THIS MUST BE TAKEN OUT WHEN IN PRODUCTION
var token = `xoxb-48507738372-KwxgAW6WrQN2tG0S61619R1F`; // this is token to navi_bot specifically

/**
 *      SET UP NAVI TO RUN
 */
var controller = Botkit.slackbot();

var bot = controller.spawn({
    token
});

bot.startRTM((err, bot, payload) => {
    console.log("RTM Connection finished! Bot is now on and listening");
});

/**
 *      SET UP NAVI'S CONTROLLERS
 */
tasksController(controller);
