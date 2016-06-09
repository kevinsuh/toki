import Botkit from 'botkit';
import os from 'os';
import tasksController from './tasks';
import workSessionsController from './work_sessions';
import setupBot from '../bot';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';
import miscellaneousController from './miscellaneousController';
import Wit from 'botkit-middleware-witai';

import { firstInstallInitiateConversation } from '../actions/initiation';

require('dotenv').config();

// Wit Brain
if (process.env.WIT_TOKEN) {

  console.log("Integrate Wit Brain");
  var wit = Wit({
    token: process.env.WIT_TOKEN,
    minimum_confidence: 0.55
  });
  
} else {
  console.log("NO?");
  console.log(process.env.SLACK_ID);
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

export function connectUsers() {

  controller.storage.users.all((err, allUserData) => {
    console.log("ALL USERS!");
    console.log(allUserData);

    if (false) {
     isnew = false;
      if (!user) {
          isnew = true;
          user = {
              id: identity.user_id,
              access_token: auth.access_token,
              scopes: scopes,
              team_id: identity.team_id,
              user: identity.user,
          };
      }
      slack.controller.storage.users.save(user, function(err, id) {
        if (err) {
          console.log('An error occurred while saving a user: ', err);
          slack.controller.trigger('error', [err]);
        }
        else {
          if (isnew) {
            console.log("New user " + id.toString() + " saved");
          }
          else {
            console.log("User " + id.toString() + " updated");
          }
          console.log("================== END TEAM REGISTRATION ==================")
        }
      });
    }; 
  });
  console.log(controller.storage);

  controller.storage.teams.all((err, allTeamData) => {
    console.log("ALL TEAMS!");
    console.log(allTeamData);

  });
      
}

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

// start RTM API here
controller.on('create_bot', (bot,team) => {

  if (bots[bot.config.token]) {
    // already online! do nothing.
    console.log("already online! do nothing.")
  }
  else {

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

      firstInstallInitiateConversation(bot, team);

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
