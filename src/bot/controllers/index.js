import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';

// config modules
import tasksController from './tasks';
import workSessionsController from './work_sessions';
import remindersController from './reminders';
import daysController from './days';
import setupBot from '../bot';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';
import miscellaneousController from './miscellaneousController';
require('dotenv').config();

// actions
import { firstInstallInitiateConversation, loginInitiateConversation } from '../actions/initiation';

// Wit Brain
if (process.env.WIT_TOKEN) {

  console.log("Integrate Wit");
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

var controller = Botkit.slackbot();

export { controller };

// simple way to keep track of bots
var bots = {};

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.PORT) {
  console.log('Error: Specify SLACK_ID SLACK_SECRET and PORT in environment');
  process.exit(1);
}

// Custom Navi Config
export function customConfigBot(controller) {

  // beef up the bot
  setupBot(controller);
  setupReceiveMiddleware(controller);

  // add controller functionalities
  daysController(controller);
  tasksController(controller);
  workSessionsController(controller);
  miscellaneousController(controller);
  remindersController(controller);
}

// try to avoid repeat RTM's
function trackBot(bot) {
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

export function connectOnLogin(team_config) {
  var bot = controller.spawn(team_config);
  controller.trigger('login_bot', [bot, team_config]);
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
controller.on('login_bot', (bot,team) => {

  if (bots[bot.config.token]) {
    // already online! do nothing.
    console.log("already online! do nothing.")
  } else {
    bot.startRTM((err) => {
      if (!err) {
        console.log("RTM on and listening");
        customConfigBot(bot);
        trackBot(bot);
        controller.saveTeam(team, (err, id) => {
          if (err) {
            console.log("Error saving team")
          }
          else {
            console.log("Team " + team.name + " saved")
          }
        })
        loginInitiateConversation(bot, team);
      } else {
        console.log("RTM failed")
        console.log(err);
      }
    });
  }
});

//DIALOG
controller.storage.teams.all(function(err,teams) {

  console.log(teams)

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t  in teams) {
    if (teams[t].bot) {
      var bot = controller.spawn(teams[t]).startRTM(function(err) {
        if (err) {
          console.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
    }
  }

});

/**
 *      CATCH ALL BUCKET FOR WIT INTENTS
 */

// this will send message if no other intent gets picked up
controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

  // this means that user said something that we cannot handle yet
  if (!message.selectedIntent) {
    bot.reply(message, "Hey! I can only help you with a few things. Here's the list of things I can help you with:");

    var options = ['end this session early', 'set a reminder', 'view your task list', 'add a task to your list', 'end your day', 'return to session and forget this interaction ever occured'];
    var optionsList = "```";
    options.forEach((option) => {
      optionsList = `${optionsList}${option}\n`
    })
    optionsList = `${optionsList}\`\`\``

    bot.reply(message, optionsList);
  }

});


