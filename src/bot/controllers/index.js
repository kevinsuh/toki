import Botkit from 'botkit';
import os from 'os';
import Wit from 'botkit-middleware-witai';
import moment from 'moment-timezone';

// config modules
import tasksController from './tasks';
import workSessionsController from './work_sessions';
import remindersController from './reminders';
import daysController from './days';
import buttonsController from './buttons';
import setupBot from '../bot';
import setupReceiveMiddleware from '../middleware/receiveMiddleware';
import miscController from './misc';

import models from '../../app/models';
import intentConfig from '../lib/intents';
import { colorsArray, THANK_YOU } from '../lib/constants';

import storageCreator from '../lib/storage';

require('dotenv').config();

var env = process.env.NODE_ENV || 'development';
if (env == 'development') {
  console.log("\n\n ~~ In development controller of Navi ~~ \n\n");
  process.env.SLACK_ID = process.env.DEV_SLACK_ID;
  process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
}

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

var config = {};
const storage = storageCreator(config);
var controller = Botkit.slackbot({
  interactive_replies: true,
  storage
});
export { controller };

// simple way to keep track of bots
var bots = {};

if (!process.env.SLACK_ID || !process.env.SLACK_SECRET || !process.env.HTTP_PORT) {
  console.log('Error: Specify SLACK_ID SLACK_SECRET and HTTP_PORT in environment');
  process.exit(1);
}

// Custom Navi Config
export function customConfigBot(controller) {

  // beef up the bot
  setupBot(controller);
  setupReceiveMiddleware(controller);

  miscController(controller);
  daysController(controller);
  tasksController(controller);
  workSessionsController(controller);
  remindersController(controller);
  buttonsController(controller);
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

      console.log("\n\n\n ~~ IN NEW SESSION GROUP DECISION ~~ \n\n\n");
      console.log("\n\n\n ~~ this is the dispatch center for many decisions ~~ \n\n\n");
      console.log("\n\n\n config object: \n\n\n");
      console.log(config);
      console.log("\n\n\n\n");

      // should start day and everything past this is irrelevant
      var shouldStartDay = false;
      if (sessionGroups.length == 0) {
        shouldStartDay = true;
      } else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
        shouldStartDay = true;
      }
      if (shouldStartDay) {
        bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
          convo.say("Wait, you have not started a day yet!");
          convo.next();
          convo.on('end', (convo) => {
            controller.trigger(`user_confirm_new_day`, [ bot, { SlackUserId }]);
          });
        });
        return;
      }

      // 2. you have already `started your day`, but it's been 5 hours since working with me
      var fiveHoursAgo = new Date(moment().subtract(5, 'hours'));
      user.getWorkSessions({
        where: [`"WorkSession"."endTime" > ?`, fiveHoursAgo]
      })
      .then((workSessions) => {

        // you have had at least one work session in the last 5 hours
        // so we will pass you through and not have you start a new day
        if (workSessions.length > 0) {
          switch (intent) {
            case intentConfig.ADD_TASK:
              controller.trigger(`add_task_flow`, [ bot, { SlackUserId }]);
              break;
            case intentConfig.START_SESSION:
              controller.trigger(`confirm_new_session`, [ bot, { SlackUserId } ]);
              break;
            case intentConfig.VIEW_TASKS:
              controller.trigger(`view_daily_tasks_flow`, [ bot, { SlackUserId } ]);
              break;
            case intentConfig.END_DAY:
              controller.trigger(`trigger_day_end`, [ bot, { SlackUserId } ]);
              break;
            default: break;
          }
          return;
        }

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
                case intentConfig.VIEW_TASKS:
                  controller.trigger(`view_daily_tasks_flow`, [ bot, { SlackUserId } ]);
                  break;
                case intentConfig.END_DAY:
                  controller.trigger(`trigger_day_end`, [ bot, { SlackUserId } ]);
                  break;
                default: break;
              }
            }

          });

        });
      });
    });
  });
});


