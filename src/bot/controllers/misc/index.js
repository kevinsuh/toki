import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

export default function(controller) {
  // this will send message if no other intent gets picked up
  controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

    const SlackUserId = message.user;

    console.log("\n\n\n ~~ in back up area!!! ~~ \n\n\n");
    console.log(message);

    startWorkSessionTest(bot, message);
     

  if (false) {

    // user said something outside of wit's scope
    if (!message.selectedIntent) {

      bot.send({
        type: "typing",
        channel: message.channel
      });
      setTimeout(() => {

        // different fallbacks based on reg exp
        const { text } = message;

        console.log(THANK_YOU.reg_exp);
        console.log(text);

        if (THANK_YOU.reg_exp.test(text)) {
          bot.reply(message, "You're welcome!! :smile:");
        } else if (true) {

         bot.reply("OKIE!");


        } else {
          // end-all fallback
          var options = [ { title: 'start a day', description: 'get started on your day' }, { title: 'start a session', description: 'start a work session with me' }, { title: 'end session early', description: 'end your current work session with me' }];
          var colorsArrayLength = colorsArray.length;
          var optionsAttachment = options.map((option, index) => {
            var colorsArrayIndex = index % colorsArrayLength;
            return {
              fields: [
                {
                  title: option.title,
                  value: option.description
                }
              ],
              color: colorsArray[colorsArrayIndex].hex
            };
          })

          bot.reply(message, "Hey! I can only help you with a few things. Here's the list of things I can help you with:");
          bot.reply(message, {
            attachments: optionsAttachment
          });
        }

      }, 1000);

    }
  }

  });

function startWorkSessionTest(bot, message) {

    const SlackUserId = message.user;

    models.User.find({
      where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
      include: [
        models.SlackUser
      ]
    }).then((user) => {

      bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

        var name = user.nickName || user.email;

        // configure necessary properties on convo object
        convo.name = name;

        // object that contains values important to this conversation
        convo.sessionStart = {
          UserId: user.id,
          SlackUserId
        };

        // FIND DAILY TASKS, THEN START THE CONVERSATION
        user.getDailyTasks({
          where: [`"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live"],
          order: `"priority" ASC`,
          include: [ models.Task ]
        }).then((dailyTasks) => {

            // save the daily tasks for reference
            dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
            convo.sessionStart.dailyTasks = dailyTasks;

            // user needs to enter daily tasks
            if (dailyTasks.length == 0) {
              convo.sessionStart.noDailyTasks = true;
              convo.stop();
            } else {
              // entry point of thy conversation
              startSessionStartConversation(err, convo);
            }
            
        });

        // on finish convo
        convo.on('end', (convo) => {

          var responses        = convo.extractResponses();
          var { sessionStart } = convo;
          var { SlackUserId } = sessionStart;

          // proxy that some odd bug has happened
          // impossible to have 1+ daily tasks and no time estimate
          if (sessionStart.dailyTasks.length > 0 && !sessionStart.calculatedTimeObject) {

            bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
              convo.say("Sorry but something went wrong :dog:. Please try `start a session` again");
              convo.next();
            });
            
            return;
          }

          if (convo.status == 'completed') {

            console.log("finished and this is the data:");
            console.log(sessionStart);

            /**
             *    1. tell user time and tasks to work on
             *    
             *    2. save responses to DB:
             *      session:
             *        - tasks to work on (tasksToWorkOnHash)
             *        - sessionEndTime (calculated)
             *        - reminder (time + possible customNote)
             *
             *    3. start session
             */

            var { UserId, SlackUserId, dailyTasks, calculatedTime, calculatedTimeObject, tasksToWorkOnHash, checkinTimeObject, reminderNote } = sessionStart;

            // if user wanted a checkin reminder
            if (checkinTimeObject) {
              var checkInTimeStamp = checkinTimeObject.format("YYYY-MM-DD HH:mm:ss");
              models.Reminder.create({
                remindTime: checkInTimeStamp,
                UserId,
                customNote: reminderNote,
                type: "work_session"
              });
            }

            // 1. create work session 
            // 2. attach the daily tasks to work on during that work session
            var startTime = moment().format("YYYY-MM-DD HH:mm:ss");
            var endTime   = calculatedTimeObject.format("YYYY-MM-DD HH:mm:ss");

            // create necessary data models:
            //  array of Ids for insert, taskObjects to create taskListMessage
            var dailyTaskIds       = [];
            var tasksToWorkOnArray = [];
            for (var key in tasksToWorkOnHash) {
              var task = tasksToWorkOnHash[key];
              dailyTaskIds.push(task.dataValues.id);
              tasksToWorkOnArray.push(task);
            }

            models.WorkSession.create({
              startTime,
              endTime,
              UserId
            }).then((workSession) => {
              workSession.setDailyTasks(dailyTaskIds);
            });

            var taskListMessage = convertArrayToTaskListMessage(tasksToWorkOnArray);

            bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
              convo.say(`Excellent! See you at ${calculatedTime}! :timer_clock:`);
              convo.say(`Good luck with: \n${taskListMessage}`);
              convo.next();
            });

          } else {

            // ending convo prematurely

            if (sessionStart.noDailyTasks) {

              const { task }                = convo;
              const { bot, source_message } = task;

              var fiveHoursAgo = new Date(moment().subtract(5, 'hours'));
              user.getWorkSessions({
                where: [`"WorkSession"."endTime" > ?`, fiveHoursAgo]
              })
              .then((workSessions) => {

                // start a new day if you have not had a work session in 5 hours
                const startNewDay = (workSessions.length == 0 ? true : false);
                bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

                  convo.startNewDay = startNewDay;

                  if (startNewDay) {
                    convo.say("Hey! You haven't entered any tasks yet today. Let's start the day before doing a session :muscle:");
                  } else {
                    convo.say("Hey! You actually don't have any tasks right now. Let's get things to work on first");
                  }
                  
                  convo.next();
                  convo.on('end', (convo) => {
                    // go to start your day from here
                    var config          = { SlackUserId };
                    var { startNewDay } = convo;

                    if (startNewDay) {
                      controller.trigger('begin_day_flow', [bot, config]);
                    } else {
                      controller.trigger('add_task_flow', [ bot, config ]);
                    }

                  })
                });

              });
              
            } else {
              // default premature end!
              bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
                convo.say("Okay! Exiting now. Let me know when you want to start on a session");
                convo.next();
              });
            }

          }
        });
      });
    });

  };
}



// user just started conversation and is choosing which tasks to work on
function startSessionStartConversation(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const { UserId, dailyTasks }  = convo.sessionStart;

  convo.say("Let's do it :weight_lifter:");
  convo.say(`Which tasks would you like to work on?`);

  var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

  convo.say(taskListMessage);
  askWhichTasksToWorkOn(response, convo);
  convo.next();

}

// confirm user for the tasks and 
function askWhichTasksToWorkOn(response, convo) {
  // this should only be said FIRST_TIME_USER
  // convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");
  convo.ask("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`", (response, convo) => {
    confirmTasks(response, convo);
    convo.next();
  }, { 'key' : 'tasksToWorkOn' });
}

function confirmTasks(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const { dailyTasks }          = convo.sessionStart;
  var { tasksToWorkOn }         = convo.responses;
  var tasksToWorkOnSplitArray   = tasksToWorkOn.text.split(/(,|and)/);

  // if we capture 0 valid tasks from string, then we start over
  var numberRegEx = new RegExp(/[\d]+/);
  var taskNumbersToWorkOnArray = []; // user assigned task numbers
  tasksToWorkOnSplitArray.forEach((taskString) => {
    console.log(`task string: ${taskString}`);
    var taskNumber = taskString.match(numberRegEx);
    if (taskNumber) {
      taskNumber = parseInt(taskNumber[0]);
      if (taskNumber <= dailyTasks.length) {
        taskNumbersToWorkOnArray.push(taskNumber);
      }
    }
  });

  // invalid if we captured no tasks
  var isInvalid = (taskNumbersToWorkOnArray.length == 0 ? true : false);
  var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

  // repeat convo if invalid w/ informative context
  if (isInvalid) {
    convo.say("Oops, I don't totally understand :dog:. Let's try this again");
    convo.say("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`");
    convo.say(taskListMessage);
    askWhichTasksToWorkOn(response, convo);
    return;
  }

  // if not invalid, we can set the tasksToWorkOnArray
  var tasksToWorkOnHash = {}; // organize by task number assigned from user
  taskNumbersToWorkOnArray.forEach((taskNumber) => {
    var index = taskNumber - 1; // make this 0-index based
    if (dailyTasks[index])
      tasksToWorkOnHash[taskNumber] = dailyTasks[index];
  });

  convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
  confirmTimeForTasks(response,convo);
  convo.next();

}

// calculate ask about the time to the given tasks
function confirmTimeForTasks(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const { tasksToWorkOnHash, dailyTasks }  = convo.sessionStart;
  const SlackUserId = response.user;

  var totalMinutes = 0;
  for (var key in tasksToWorkOnHash) {
    const task = tasksToWorkOnHash[key];
    var { dataValues: { minutes } } = task;
    totalMinutes += parseInt(minutes);
  }

  var now = moment();
  var calculatedTimeObject = now.add(totalMinutes, 'minutes');
  var calculatedTimeString = calculatedTimeObject.format("h:mm a");

  // these are the final values used to determine work session info
  convo.sessionStart.totalMinutes         = totalMinutes;
  convo.sessionStart.calculatedTime       = calculatedTimeString;
  convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

  finalizeWorkSessionStart(response, convo);


  if (false) {
    /**
     *    We may need to do something like this if Node / Sequelize
     *    does not handle west coast as I idealistically hope for
     */
    
    // get timezone of user before continuing
    bot.api.users.list({
      presence: 1
    }, (err, response) => {
      const { members } = response; // members are all users registered to your bot

      for (var i = 0; i < members.length; i++) {
        if (members[i].id == SlackUserId) {
          var timeZoneObject = {};
          timeZoneObject.tz = members[i].tz;
          timeZoneObject.tz_label = members[i].tz_label;
          timeZoneObject.tz_offset = members[i].tz_offset;
          convo.sessionStart.timeZone = timeZoneObject;
          break;
        }
      }

      var { timeZone } = convo.sessionStart;
      if (timeZone && timeZone.tz) {
        timeZone = timeZone.tz;
      } else {
        timeZone = "America/New_York"; // THIS IS WRONG AND MUST BE FIXED
        // SOLUTION IS MOST LIKELY TO ASK USER HERE WHAT THEIR TIMEZONE IS.
      }
    });

  }

}

// the final place to start a work session
function finalizeWorkSessionStart(response, convo) {

  const { sessionStart: { totalMinutes, calculatedTimeObject, calculatedTime, tasksToWorkOnHash, dailyTasks } } = convo;

  // convert hash to array
  var tasksToWorkOnArray = [];
  for (var key in tasksToWorkOnHash) {
    tasksToWorkOnArray.push(tasksToWorkOnHash[key]);
  }
  var taskTextsToWorkOnArray = tasksToWorkOnArray.map((task) => {
    const { dataValues: { text } } = task;
    return text;
  });
  var tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

  convo.ask({
    text: `Great! Working on tasks ${tasksToWorkOnString} will take you to *${calculatedTime}* based on your estimate`,
    attachments:[
      {
        text: 'Ready to begin?',
        attachment_type: 'default',
        callback_id: "START_SESSION",
        color: colorsHash.turquoise.hex,
        fallback: "I was unable to process your decision",
        actions: [
          {
              name: buttonValues.startNow.name,
              text: "Start :punch:",
              value: buttonValues.startNow.value,
              type: "button",
              style: "primary"
          },
          {
              name: buttonValues.checkIn.name,
              text: "Check in :alarm_clock:",
              value: buttonValues.checkIn.value,
              type: "button"
          },
          {
              name: buttonValues.changeTask.name,
              text: "Change Task",
              value: buttonValues.changeTask.value,
              type: "button",
              style: "danger"
          },
          {
              name: buttonValues.changeTime.name,
              text: "Change Time",
              value: buttonValues.changeTime.value,
              type: "button",
              style: "danger"
          }
        ]
      }
    ]
  },
  [
    {
      pattern: buttonValues.startNow.value,
      callback: function(response, convo) {
        convo.say("Let's start now!");
        convo.next();
        // do something awesome here.
      }
    },
    {
      pattern: buttonValues.checkIn.value,
      callback: function(response, convo) {
        convo.say("Let's check in!");
        convo.next();
      }
    },
    {
      pattern: buttonValues.changeTask.value,
      callback: function(response, convo) {
        var taskListMessage = convertArrayToTaskListMessage(dailyTasks);
        convo.say(taskListMessage);
        askWhichTasksToWorkOn(response, convo);
        convo.next();
      }
    },
    {
      pattern: buttonValues.changeTime.value,
      callback: function(response, convo) {
        askForCustomTotalMinutes(response, convo);
        convo.next();
      }
    },
    {
      default: true,
      callback: function(response, convo) {
        // this is failure point.
        convo.stop();
        convo.next();
      }
    }
  ]);
}

// ask for custom amount of time to work on
function askForCustomTotalMinutes(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const SlackUserId = response.user;

  convo.ask("What time would you like to work until? You can also tell me the duration you'd like to work, like `55 minutes` :upside_down_face:", (response, convo) => {

    var { intentObject: { entities } } = response;
    // for time to tasks, these wit intents are the only ones that makes sense
    if (entities.duration || entities.custom_time) {
      confirmCustomTotalMinutes(response, convo);
    } else {
      // invalid
      convo.say("I'm sorry, I didn't catch that :dog:");
      convo.repeat();
    }

    convo.next();

  });

};

function confirmCustomTotalMinutes(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const SlackUserId             = response.user;
  var now                       = moment();

  // use Wit to understand the message in natural language!
  var { intentObject: { entities } } = response;
  var customTimeObject; // moment object of time
  var customTimeString; // format to display (`h:mm a`)
  var customTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)
  if (entities.duration) {

    var durationArray = entities.duration;
    var durationSeconds = 0;
    for (var i = 0; i < durationArray.length; i++) {
      durationSeconds += durationArray[i].normalized.value;
    }
    var durationMinutes = Math.floor(durationSeconds / 60);

    // add minutes to now
    customTimeObject = moment().add(durationSeconds, 'seconds');
    customTimeString = customTimeObject.format("h:mm a");

  } else if (entities.custom_time) {
    // get rid of timezone to make it tz-neutral
    // then create a moment-timezone object with specified timezone
    var timeStamp = entities.custom_time[0].value;

    // create time object based on user input + timezone
    customTimeObject = moment(timeStamp);
    customTimeObject.add(customTimeObject._tzm - now.utcOffset(), 'minutes');
    customTimeString = customTimeObject.format("h:mm a");

  }



  convo.ask(`So you'd like to work until ${customTimeString}?`, [
    {
      pattern: utterances.yes,
      callback: (response, convo) => {

        var now             = moment();
        var minutesDuration = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

        // success! now save session time info for the user
        convo.sessionStart.totalMinutes         = minutesDuration;
        convo.sessionStart.calculatedTime       = customTimeString;
        convo.sessionStart.calculatedTimeObject = customTimeObject;

        askForCheckIn(response, convo);
        convo.next();

      }
    },
    {
      pattern: utterances.no,
      callback: (response, convo) => {
        convo.ask("Yikes, my bad. Let's try this again. Just tell me how many minutes (`ex. 45 min`) or until what time (`ex. 3:15pm`) you'd like to work right now", (response, convo) => {
          confirmCustomTotalMinutes(response, convo);
          convo.next();
        });
        convo.next();
      }
    }
  ]);

}

// ask if user wants a checkin during middle of session
function askForCheckIn(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const SlackUserId = response.user;

  convo.ask("Boom :boom: Would you like me to check in with you during this session to make sure you're on track?", [
    {
      pattern: utterances.yes,
      callback: (response, convo) => {
        convo.say("Sure thing! Let me know what time you want me to check in with you");
        convo.ask("I can also check in a certain number of minutes or hours from now, like `40 minutes` or `1 hour`", (response, convo) => {

          var { intentObject: { entities } } = response;
          // for time to tasks, these wit intents are the only ones that makes sense
          if (entities.duration || entities.custom_time) {
            confirmCheckInTime(response, convo);
          } else {
            // invalid
            convo.say("I'm sorry, I didn't catch that :dog:");
            convo.say("Please put either a time like `2:41pm`, or a number of minutes or hours like `35 minutes`");
            convo.silentRepeat();
          }

          convo.next();

        }, { 'key' : 'respondTime' });
        convo.next();
      }
    },
    {
      pattern: utterances.no,
      callback: (response, convo) => {
        convo.next();
      }
    }
  ]);

}

// confirm check in time with user
function confirmCheckInTime(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const SlackUserId             = response.user;
  var now                       = moment();

  // use Wit to understand the message in natural language!
  var { intentObject: { entities } } = response;
  var checkinTimeObject; // moment object of time
  var checkinTimeString; // format to display (`h:mm a`)
  var checkinTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)
  if (entities.duration) {

    var durationArray = entities.duration;
    var durationSeconds = 0;
    for (var i = 0; i < durationArray.length; i++) {
      durationSeconds += durationArray[i].normalized.value;
    }
    var durationMinutes = Math.floor(durationSeconds / 60);

    // add minutes to now
    checkinTimeObject = moment().add(durationSeconds, 'seconds');
    checkinTimeString = checkinTimeObject.format("h:mm a");

  } else if (entities.custom_time) {
    // get rid of timezone to make it tz-neutral
    // then create a moment-timezone object with specified timezone
    var timeStamp = entities.custom_time[0].value;
    timeStamp = moment(timeStamp); // in PST because of Wit default settings

    timeStamp.add(timeStamp._tzm - now.utcOffset(), 'minutes');
    // create time object based on user input + timezone
    
    checkinTimeObject = timeStamp;
    checkinTimeString = checkinTimeObject.format("h:mm a");

  }

  convo.ask(`I'll be checking in with you at ${checkinTimeString}. Is that correct?`, [
    {
      pattern: utterances.yes,
      callback: (response, convo) => {

        var now             = moment();
        var minutesDuration = Math.round(moment.duration(checkinTimeObject.diff(now)).asMinutes());

        // success! now save checkin time info for the user
        convo.sessionStart.checkinTimeObject = checkinTimeObject;
        convo.sessionStart.checkinTimeString = checkinTimeString;
        
        askForReminderDuringCheckin(response, convo);
        convo.next();

      }
    },
    {
      pattern: utterances.no,
      callback: (response, convo) => {
        convo.say(`Let's rewind :vhs: :rewind:`);
        convo.ask("What time would you like me to check in with you? Just tell me a time or a certain number of minutes from the start of your session you'd like me to check in", (response, convo) => {
          confirmCheckInTime(response, convo);
          convo.next();
        });
        convo.next();
      }
    }
  ]);


}

function askForReminderDuringCheckin(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const SlackUserId = response.user;

  convo.say("Last thing - is there anything you'd like me to remind you during the check in?");
  convo.ask("This could be a note like `call Eileen` or `should be on the second section of the proposal by now`", [
    {
      pattern: utterances.yes,
      callback: (response, convo) => {
        convo.ask(`What note would you like me to remind you about?`, (response, convo) => {
          getReminderNoteFromUser(response, convo);
          convo.next();
        });

        convo.next();
      }
    },
    {
      pattern: utterances.no,
      callback: (response, convo) => {
        convo.next();
      }
    },
    {
      default: true,
      callback: (response, convo) => {
        // we are assuming anything else is the reminderNote
        getReminderNoteFromUser(response, convo);
        convo.next();
      }
    }
  ], { 'key' : 'reminderNote' });

}

function getReminderNoteFromUser(response, convo) {

  const { task }                = convo;
  const { bot, source_message } = task;
  const SlackUserId = response.user;

  const note = response.text;

  const { sessionStart: { checkinTimeObject, checkinTimeString } } = convo;

  convo.ask(`Does this look good: \`${note}\`?`, [
    {
      pattern: utterances.yes,
      callback: (response, convo) => {

        convo.sessionStart.reminderNote = note;
        convo.next();

      }
    },
    {
      pattern: utterances.no,
      callback: (response, convo) => {
        convo.ask(`Just tell me a one-line note and I'll remind you about it at ${checkinTimeString}!`, (response, convo) => {
          getReminderNoteFromUser(response, convo);
          convo.next();
        })
        convo.next();
      }
    }
  ]);

}


