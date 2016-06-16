import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';
import moment from 'moment-timezone';

// config modules
import tasksController from './tasks';
import workSessionsController from './work_sessions';
import remindersController from './reminders';
import daysController from './days';
import setupBot from '../bot';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';
import miscellaneousController from './miscellaneousController';

import models from '../../app/models';
import intentConfig from '../lib/intents';

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

    var options = ['start a session', 'end session early', 'set a reminder', 'view your task list', 'add a task to your list', 'end your day', 'return to session and forget this interaction ever occured'];
    var optionsList = "```";
    options.forEach((option) => {
      optionsList = `${optionsList}${option}\n`
    })
    optionsList = `${optionsList}\`\`\``

    bot.reply(message, optionsList);
  }

});

/**
 *      CATCH FOR WHETHER WE SHOULD START
 *        A NEW SESSION GROUP (AKA A NEW DAY) OR NOT
 *    1) if have not started day yet, then this will get triggered
 *    2) if it has been 5 hours, then this will get this trigger
 */
controller.on(`new_session_group_decision`, (bot, config) => {

  // type is either `ADD_TASK` or `START_SESSION`
  const { SlackUserId, intent } = config;

  models.User.find({
    where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
    include: [ models.SlackUser ]
  })
  .then((user) => {

    var name     = user.nickName || user.email;
    const UserId = user.id;

    // 1. has user started day yet?
    user.getSessionGroups({
      order: `"SessionGroup"."createdAt" DESC`,
      limit: 1
    })
    .then((sessionGroups) => {

      // should start day
      var shouldStartDay = false;
      if (sessionGroups.length == 0) {
        shouldStartDay = true;
      } else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
        shouldStartDay = true;
      }
      if (shouldStartDay) {
        bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
          convo.say("You have not started a day yet! Let me know when you want to `start a day` together :smile:");
          convo.next();
          convo.on('end', (convo) => {
            controller.trigger(`begin_day_flow`, [ bot, { SlackUserId }]);
          });
        });
        return;
      }

      // 2. you have started your day, it's been 5 hours since working with me
      var fiveHoursAgo = new Date(moment().subtract(5, 'hours'));
      user.getWorkSessions({
        where: [`"WorkSession"."endTime" > ?`, fiveHoursAgo]
      })
      .then((workSessions) => {

        // this means you have not
        // had a work session in the last 5 hours
        if (workSessions.length == 0) {

          bot.startPrivateConversation ({ user: SlackUserId }, (err, convo) => {

            convo.name = name;
            convo.newSessionGroup = {
              decision: false // for when you want to end early
            };

            convo.say(`Hey ${name}! It's been a while since we worked together`);
            convo.ask("If your priorities changed, I recommend that you `start your day` to kick the tires :car:, otherwise let's `continue`", (response, convo) => {

              var responseMessage = response.text;

              // 1. `start your day`
              // 2. `add a task`
              // 3. anything else will exit
              var startDay = new RegExp(/(((^st[tart]*))|(^d[ay]*))/); // `start` or `day`
              var letsContinue = new RegExp(/((^co[ntinue]*))/); // `add` or `task`

              if (startDay.test(responseMessage)) {
                // start new day
                convo.say("Got it. Let's do it! :weight_lifter:");
                convo.newSessionGroup.decision = intentConfig.START_DAY;
              } else if (letsContinue.test(responseMessage)) {
                // continue with add task flow
                convo.say("Got it. Let's continue on :muscle:");
                convo.newSessionGroup.decision = intent;
              } else {
                // default is to exit this conversation entirely
                convo.say("Okay! I'll be here for whenever you're ready");
              }
              convo.next();
            });

            
            convo.on('end', (convo) => {

              console.log("end of start new session group");
              const { newSessionGroup } = convo;

              if (newSessionGroup.decision == intentConfig.START_DAY) {
                controller.trigger(`begin_day_flow`, [ bot, { SlackUserId }]);
                return;
              } else {
                switch (intent) {
                  case intentConfig.ADD_TASK:
                    controller.trigger(`add_task_flow`, [ bot, { SlackUserId }]);
                    break;
                  case intentConfig.START_SESSION:
                  controller.trigger(`confirm_new_session`, [ bot, { SlackUserId } ]);
                    break;
                  default: break;
                }
              }

            });

          });
        } else {

          // you have had a recent work session and are ready to just get passed through
          switch (intent) {
            case intentConfig.ADD_TASK:
              controller.trigger(`add_task_flow`, [ bot, { SlackUserId }]);
              break;
            case intentConfig.START_SESSION:
              controller.trigger(`confirm_new_session`, [ bot, { SlackUserId } ]);
              break;
            default: break;
          }

        }
      });
    });
  });
});

