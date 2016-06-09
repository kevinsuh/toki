import Botkit from 'botkit';
import os from 'os';
import tasksController from './tasks';
import workSessionsController from './work_sessions';
import setupBot from '../bot';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';
import miscellaneousController from './miscellaneousController';
import Wit from 'botkit-middleware-witai';

import { firstInstallInitiateConversation, loginInitiateConversation } from '../actions/initiation';

require('dotenv').config();

// Wit Brain
if (process.env.WIT_TOKEN) {

  console.log("Integrate Wit Brain");
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
 *    CONFIG
 */

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.PORT) {
  console.log('Error: Specify SLACK_ID SLACK_SECRET and PORT in environment');
  process.exit(1);
}



var controller = Botkit.slackbot();
export { controller };

//CONNECTION FUNCTIONS
export function connectOnInstall(team_config) {
  var bot = controller.spawn(team_config);
  controller.trigger('create_bot', [bot, team_config]);
}

export function connectOnLogin(team_config) {

  var bot = controller.spawn(team_config);
  controller.trigger('login_bot', [bot, team_config]);

}

// for subsequent logins
// start RTM API here
controller.on('login_bot', (bot,team) => {

  if (bots[bot.config.token]) {
    // already online! do nothing.
    console.log("already online! do nothing.")
  } else {
    bot.startRTM((err) => {
      if (!err) {
        customConfigBot(bot);
        trackBot(bot);
        console.log("RTM on and listening\n\n\n\n\n\n\n\n\n\n\n");
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

// for first time create
// start RTM API here
controller.on('create_bot', (bot,team) => {

  if (bots[bot.config.token]) {
    // already online! do nothing.
    console.log("already online! do nothing.")
  } else {
    bot.startRTM((err) => {
      if (!err) {
        customConfigBot(bot);
        trackBot(bot);
        console.log("RTM on and listening");
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

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var bots = {};

function trackBot(bot) {
  bots[bot.config.token] = bot;
}

// Custom Navi Config
function customConfigBot(bot) {

  /**
   *      BEEF UP NAVI BOT
   */
  setupBot(bot);
  setupReceiveMiddleware(controller);

  /**
   *      SET UP NAVI'S CONTROLLERS
   */
  tasksController(controller);
  workSessionsController(controller);
  miscellaneousController(controller);
}

// for subsequent logins
// start RTM API here
// start RTM API here
controller.on('login_bot', (bot,team) => {

  if (bots[bot.config.token]) {
    // already online! do nothing.
    console.log("already online! do nothing.")
  } else {
    bot.startRTM((err) => {
      if (!err) {
        customConfigBot(bot);
        trackBot(bot);
        console.log("RTM on and listening");
        controller.saveTeam(team, (err, id) => {
          if (err) {
            console.log("Error saving team")
          }
          else {
            console.log("Team " + team.name + " saved")
          }
        })
      }
      else {
        console.log("RTM failed")
      }
      loginInitiateConversation(bot, team);
    });
  }
});


//REACTIONS TO EVENTS

// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
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
