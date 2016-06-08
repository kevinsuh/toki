/*
# TO RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node slack_bot.js
*/

import Botkit from 'botkit';
import os from 'os';
import tasksController from './tasks';
import workSessionsController from './work_sessions';
import setupBot from '../bot';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';
import miscellaneousController from './miscellaneousController';

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

if (false) {

// /**
//  *      SET UP NAVI TO RUN
//  */
// var controller = Botkit.slackbot();

// /**
//  *      CONTROLLER FUNCTIONS
//  */
// var bot = controller.spawn({
//     token
// });

// bot.startRTM((err, bot, payload) => {
//     console.log("RTM Connection finished! Bot is now on and listening");
// });

// /**
//  *      BEEF UP NAVI BOT
//  */
// setupBot(bot);
// setupReceiveMiddleware(controller);

// /**
//  *      SET UP NAVI'S CONTROLLERS
//  */
// tasksController(controller);
// workSessionsController(controller);
// miscellaneousController(controller);

}

//CONFIG===============================================

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.PORT) {
  console.log('Error: Specify SLACK_ID SLACK_SECRET and PORT in environment');
  process.exit(1);
}

var controller = Botkit.slackbot();

//CONNECTION FUNCTIONS
export function connect(team_config) {
  var bot = controller.spawn(team_config);
  controller.trigger('create_bot', [bot, team_config]);
}

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var bots = {};

function trackBot(bot) {
  bots[bot.config.token] = bot;
}

controller.on('create_bot',function(bot,team) {

  if (bots[bot.config.token]) {
    // already online! do nothing.
    console.log("already online! do nothing.")
  }
  else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot);

        console.log("RTM ok")

        controller.saveTeam(team, function(err, id) {
          if (err) {
            console.log("Error saving team")
          }
          else {
            console.log("Team " + team.name + " saved")
          }
        })
      }

      else{
        console.log("RTM failed")
      }

      bot.startPrivateConversation({user: team.createdBy},function(err,convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say('I am a bot that has just joined your team');
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });

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
