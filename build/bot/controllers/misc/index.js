'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (controller) {
  // this will send message if no other intent gets picked up
  controller.hears([''], 'direct_message', _index.wit.hears, function (bot, message) {

    var SlackUserId = message.user;

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
        setTimeout(function () {

          // different fallbacks based on reg exp
          var text = message.text;


          console.log(_constants.THANK_YOU.reg_exp);
          console.log(text);

          if (_constants.THANK_YOU.reg_exp.test(text)) {
            bot.reply(message, "You're welcome!! :smile:");
          } else if (true) {

            bot.reply("OKIE!");
          } else {
            // end-all fallback
            var options = [{ title: 'start a day', description: 'get started on your day' }, { title: 'start a session', description: 'start a work session with me' }, { title: 'end session early', description: 'end your current work session with me' }];
            var colorsArrayLength = _constants.colorsArray.length;
            var optionsAttachment = options.map(function (option, index) {
              var colorsArrayIndex = index % colorsArrayLength;
              return {
                fields: [{
                  title: option.title,
                  value: option.description
                }],
                color: _constants.colorsArray[colorsArrayIndex].hex
              };
            });

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

    var SlackUserId = message.user;

    _models2.default.User.find({
      where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
      include: [_models2.default.SlackUser]
    }).then(function (user) {

      bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

        var name = user.nickName || user.email;

        // configure necessary properties on convo object
        convo.name = name;

        // object that contains values important to this conversation
        convo.sessionStart = {
          UserId: user.id,
          SlackUserId: SlackUserId
        };

        // FIND DAILY TASKS, THEN START THE CONVERSATION
        user.getDailyTasks({
          where: ['"Task"."done" = ? AND "DailyTask"."type" = ?', false, "live"],
          order: '"priority" ASC',
          include: [_models2.default.Task]
        }).then(function (dailyTasks) {

          // save the daily tasks for reference
          dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
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
        convo.on('end', function (convo) {

          var responses = convo.extractResponses();
          var sessionStart = convo.sessionStart;
          var SlackUserId = sessionStart.SlackUserId;
          var confirmStart = sessionStart.confirmStart;

          // proxy that some odd bug has happened
          // impossible to have 1+ daily tasks and no time estimate

          if (sessionStart.dailyTasks.length > 0 && !sessionStart.calculatedTimeObject) {

            bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
              convo.say("Sorry but something went wrong :dog:. Please try `start a session` again");
              convo.next();
            });

            return;
          }

          if (confirmStart) {

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

            var UserId = sessionStart.UserId;
            var SlackUserId = sessionStart.SlackUserId;
            var dailyTasks = sessionStart.dailyTasks;
            var calculatedTime = sessionStart.calculatedTime;
            var calculatedTimeObject = sessionStart.calculatedTimeObject;
            var tasksToWorkOnHash = sessionStart.tasksToWorkOnHash;
            var checkinTimeObject = sessionStart.checkinTimeObject;
            var reminderNote = sessionStart.reminderNote;

            // if user wanted a checkin reminder

            if (checkinTimeObject) {
              var checkInTimeStamp = checkinTimeObject.format("YYYY-MM-DD HH:mm:ss");
              _models2.default.Reminder.create({
                remindTime: checkInTimeStamp,
                UserId: UserId,
                customNote: reminderNote,
                type: "work_session"
              });
            }

            // 1. create work session
            // 2. attach the daily tasks to work on during that work session
            var startTime = (0, _moment2.default)().format("YYYY-MM-DD HH:mm:ss");
            var endTime = calculatedTimeObject.format("YYYY-MM-DD HH:mm:ss");

            // create necessary data models:
            //  array of Ids for insert, taskObjects to create taskListMessage
            var dailyTaskIds = [];
            var tasksToWorkOnArray = [];
            for (var key in tasksToWorkOnHash) {
              var task = tasksToWorkOnHash[key];
              dailyTaskIds.push(task.dataValues.id);
              tasksToWorkOnArray.push(task);
            }

            _models2.default.WorkSession.create({
              startTime: startTime,
              endTime: endTime,
              UserId: UserId
            }).then(function (workSession) {
              workSession.setDailyTasks(dailyTaskIds);
            });

            var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(tasksToWorkOnArray);

            bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
              convo.say('See you at *' + calculatedTime + '!* :timer_clock:');
              convo.say('Good luck with: \n' + taskListMessage);
              convo.next();
            });
          } else {

            // ending convo prematurely
            if (sessionStart.noDailyTasks) {
              var fiveHoursAgo;

              (function () {
                var task = convo.task;
                var bot = task.bot;
                var source_message = task.source_message;
                fiveHoursAgo = new Date((0, _moment2.default)().subtract(5, 'hours'));

                user.getWorkSessions({
                  where: ['"WorkSession"."endTime" > ?', fiveHoursAgo]
                }).then(function (workSessions) {

                  // start a new day if you have not had a work session in 5 hours
                  var startNewDay = workSessions.length == 0 ? true : false;
                  bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

                    convo.startNewDay = startNewDay;

                    if (startNewDay) {
                      convo.say("Hey! You haven't entered any tasks yet today. Let's start the day before doing a session :muscle:");
                    } else {
                      convo.say("Hey! You actually don't have any tasks right now. Let's get things to work on first");
                    }

                    convo.next();
                    convo.on('end', function (convo) {
                      // go to start your day from here
                      var config = { SlackUserId: SlackUserId };
                      var startNewDay = convo.startNewDay;


                      if (startNewDay) {
                        controller.trigger('begin_day_flow', [bot, config]);
                      } else {
                        controller.trigger('add_task_flow', [bot, config]);
                      }
                    });
                  });
                });
              })();
            } else {
              // default premature end!
              bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
                convo.say("Okay! Exiting now. Let me know when you want to start on a session");
                convo.next();
              });
            }
          }
        });
      });
    });
  };
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// user just started conversation and is choosing which tasks to work on
function startSessionStartConversation(response, convo) {
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;


  convo.say("Let's do it :weight_lifter:");
  askWhichTasksToWorkOn(response, convo);
  convo.next();
}

// confirm user for the tasks and
function askWhichTasksToWorkOn(response, convo) {
  // this should only be said FIRST_TIME_USER
  // convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

  var _convo$sessionStart = convo.sessionStart;
  var UserId = _convo$sessionStart.UserId;
  var dailyTasks = _convo$sessionStart.dailyTasks;

  convo.say('Which tasks would you like to work on?');
  var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
  convo.say(taskListMessage);
  convo.ask("Pick a task from the list `i.e. tasks 1, 3`", function (response, convo) {
    confirmTasks(response, convo);
    convo.next();
  }, { 'key': 'tasksToWorkOn' });
}

function confirmTasks(response, convo) {
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;
  var dailyTasks = convo.sessionStart.dailyTasks;
  var tasksToWorkOn = convo.responses.tasksToWorkOn;

  var tasksToWorkOnSplitArray = tasksToWorkOn.text.split(/(,|and)/);

  // if we capture 0 valid tasks from string, then we start over
  var numberRegEx = new RegExp(/[\d]+/);
  var taskNumbersToWorkOnArray = []; // user assigned task numbers
  tasksToWorkOnSplitArray.forEach(function (taskString) {
    console.log('task string: ' + taskString);
    var taskNumber = taskString.match(numberRegEx);
    if (taskNumber) {
      taskNumber = parseInt(taskNumber[0]);
      if (taskNumber <= dailyTasks.length) {
        taskNumbersToWorkOnArray.push(taskNumber);
      }
    }
  });

  // invalid if we captured no tasks
  var isInvalid = taskNumbersToWorkOnArray.length == 0 ? true : false;
  var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);

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
  taskNumbersToWorkOnArray.forEach(function (taskNumber) {
    var index = taskNumber - 1; // make this 0-index based
    if (dailyTasks[index]) tasksToWorkOnHash[taskNumber] = dailyTasks[index];
  });

  convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
  confirmTimeForTasks(response, convo);
  convo.next();
}

// calculate ask about the time to the given tasks
function confirmTimeForTasks(response, convo) {
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;
  var _convo$sessionStart2 = convo.sessionStart;
  var tasksToWorkOnHash = _convo$sessionStart2.tasksToWorkOnHash;
  var dailyTasks = _convo$sessionStart2.dailyTasks;

  var SlackUserId = response.user;

  var totalMinutes = 0;
  for (var key in tasksToWorkOnHash) {
    var _task = tasksToWorkOnHash[key];
    var minutes = _task.dataValues.minutes;

    totalMinutes += parseInt(minutes);
  }

  var now = (0, _moment2.default)();
  var calculatedTimeObject = now.add(totalMinutes, 'minutes');
  var calculatedTimeString = calculatedTimeObject.format("h:mm a");

  // these are the final values used to determine work session info
  convo.sessionStart.totalMinutes = totalMinutes;
  convo.sessionStart.calculatedTime = calculatedTimeString;
  convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

  finalizeTimeAndTasksToStart(response, convo);

  if (false) {
    /**
     *    We may need to do something like this if Node / Sequelize
     *    does not handle west coast as I idealistically hope for
     */

    // get timezone of user before continuing
    bot.api.users.list({
      presence: 1
    }, function (err, response) {
      var members = response.members; // members are all users registered to your bot

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

      var timeZone = convo.sessionStart.timeZone;

      if (timeZone && timeZone.tz) {
        timeZone = timeZone.tz;
      } else {
        timeZone = "America/New_York"; // THIS IS WRONG AND MUST BE FIXED
        // SOLUTION IS MOST LIKELY TO ASK USER HERE WHAT THEIR TIMEZONE IS.
      }
    });
  }
}

// confirm task and time in one place and start if it's good
function finalizeTimeAndTasksToStart(response, convo) {
  var _convo$sessionStart3 = convo.sessionStart;
  var totalMinutes = _convo$sessionStart3.totalMinutes;
  var calculatedTimeObject = _convo$sessionStart3.calculatedTimeObject;
  var calculatedTime = _convo$sessionStart3.calculatedTime;
  var tasksToWorkOnHash = _convo$sessionStart3.tasksToWorkOnHash;
  var dailyTasks = _convo$sessionStart3.dailyTasks;

  // convert hash to array

  var tasksToWorkOnArray = [];
  for (var key in tasksToWorkOnHash) {
    tasksToWorkOnArray.push(tasksToWorkOnHash[key]);
  }
  var taskTextsToWorkOnArray = tasksToWorkOnArray.map(function (task) {
    var text = task.dataValues.text;

    return text;
  });
  var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

  convo.ask({
    text: 'Great! Working on tasks ' + tasksToWorkOnString + ' will take you to *' + calculatedTime + '* based on your estimate',
    attachments: [{
      text: 'Ready to begin?',
      attachment_type: 'default',
      callback_id: "START_SESSION",
      color: _constants.colorsHash.turquoise.hex,
      fallback: "I was unable to process your decision",
      actions: [{
        name: _constants.buttonValues.startNow.name,
        text: "Start :punch:",
        value: _constants.buttonValues.startNow.value,
        type: "button",
        style: "primary"
      }, {
        name: _constants.buttonValues.checkIn.name,
        text: "Check in :alarm_clock:",
        value: _constants.buttonValues.checkIn.value,
        type: "button"
      }, {
        name: _constants.buttonValues.changeTask.name,
        text: "Change Task",
        value: _constants.buttonValues.changeTask.value,
        type: "button",
        style: "danger"
      }, {
        name: _constants.buttonValues.changeSessionTime.name,
        text: "Change Time",
        value: _constants.buttonValues.changeSessionTime.value,
        type: "button",
        style: "danger"
      }]
    }]
  }, [{
    pattern: _constants.buttonValues.startNow.value,
    callback: function callback(response, convo) {
      convo.sessionStart.confirmStart = true;
      convo.stop();
      convo.next();
    }
  }, {
    pattern: _constants.buttonValues.checkIn.value,
    callback: function callback(response, convo) {
      askForCheckIn(response, convo);
      convo.next();
    }
  }, {
    pattern: _constants.buttonValues.changeTask.value,
    callback: function callback(response, convo) {
      askWhichTasksToWorkOn(response, convo);
      convo.next();
    }
  }, {
    pattern: _constants.buttonValues.changeSessionTime.value,
    callback: function callback(response, convo) {
      askForCustomTotalMinutes(response, convo);
      convo.next();
    }
  }, {
    default: true,
    callback: function callback(response, convo) {
      // this is failure point.
      convo.stop();
      convo.next();
    }
  }]);
}

// this is if you want a checkin after approving of task + times
// option add note or start session immediately
function finalizeCheckinTimeToStart(response, convo) {
  var _convo$sessionStart4 = convo.sessionStart;
  var checkInTimeString = _convo$sessionStart4.checkInTimeString;
  var checkinTimeObject = _convo$sessionStart4.checkinTimeObject;
  var reminderNote = _convo$sessionStart4.reminderNote;


  var confirmCheckinMessage = '';
  if (checkInTimeString) {
    confirmCheckinMessage = 'Excellent, I\'ll check in with you at *' + checkinTimeString + '*!';
    if (reminderNote) {
      confirmCheckinMessage = 'Excellent, I\'ll check in with you at *' + checkinTimeString + '* about ' + reminderNote + '!';
    }
  }

  convo.ask({
    text: confirmCheckinMessage,
    attachments: [{
      text: 'Ready to begin the session?',
      attachment_type: 'default',
      callback_id: "START_SESSION",
      color: _constants.colorsHash.turquoise.hex,
      fallback: "I was unable to process your decision",
      actions: [{
        name: _constants.buttonValues.startNow.name,
        text: "Start :punch:",
        value: _constants.buttonValues.startNow.value,
        type: "button",
        style: "primary"
      }, {
        name: _constants.buttonValues.changeCheckinTime.name,
        text: "Change time",
        value: _constants.buttonValues.changeCheckinTime.value,
        type: "button"
      }, {
        name: _constants.buttonValues.addCheckinNote.name,
        text: "Add note",
        value: _constants.buttonValues.addCheckinNote.value,
        type: "button"
      }]
    }]
  }, [{
    pattern: _constants.buttonValues.startNow.value,
    callback: function callback(response, convo) {
      convo.sessionStart.confirmStart = true;
      convo.stop();
      convo.next();
    }
  }, {
    pattern: _constants.buttonValues.changeCheckinTime.value,
    callback: function callback(response, convo) {
      askForCheckIn(response, convo);
      convo.next();
    }
  }, {
    pattern: _constants.buttonValues.addCheckinNote.value,
    callback: function callback(response, convo) {
      askForReminderDuringCheckin(response, convo);
      convo.next();
    }
  }, {
    pattern: _constants.buttonValues.changeSessionTime.value,
    callback: function callback(response, convo) {
      askForCustomTotalMinutes(response, convo);
      convo.next();
    }
  }, {
    default: true,
    callback: function callback(response, convo) {
      // this is failure point.
      convo.stop();
      convo.next();
    }
  }]);
}

// ask for custom amount of time to work on
function askForCustomTotalMinutes(response, convo) {
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;

  var SlackUserId = response.user;

  convo.ask("What time would you like to work until?", function (response, convo) {
    var entities = response.intentObject.entities;
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
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;

  var SlackUserId = response.user;
  var now = (0, _moment2.default)();

  // use Wit to understand the message in natural language!
  var entities = response.intentObject.entities;

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
    customTimeObject = (0, _moment2.default)().add(durationSeconds, 'seconds');
    customTimeString = customTimeObject.format("h:mm a");
  } else if (entities.custom_time) {
    // get rid of timezone to make it tz-neutral
    // then create a moment-timezone object with specified timezone
    var timeStamp = entities.custom_time[0].value;

    // create time object based on user input + timezone
    customTimeObject = (0, _moment2.default)(timeStamp);
    customTimeObject.add(customTimeObject._tzm - now.utcOffset(), 'minutes');
    customTimeString = customTimeObject.format("h:mm a");
  }

  convo.sessionStart.totalMinutes = minutesDuration;
  convo.sessionStart.calculatedTime = customTimeString;
  convo.sessionStart.calculatedTimeObject = customTimeObject;

  finalizeTimeAndTasksToStart(response, convo);
}

// ask if user wants a checkin during middle of session
function askForCheckIn(response, convo) {
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;

  var SlackUserId = response.user;

  convo.ask("When would you like me to check in with you?", function (response, convo) {
    var entities = response.intentObject.entities;
    // for time to tasks, these wit intents are the only ones that makes sense

    if (entities.duration || entities.custom_time) {
      // || entities.reminder
      confirmCheckInTime(response, convo);
    } else {
      // invalid
      convo.say("I'm sorry, I didn't catch that :dog:");
      convo.say("Please put either a time like `2:41pm`, or a number of minutes or hours like `35 minutes`");
      convo.silentRepeat();
    }

    convo.next();
  }, { 'key': 'respondTime' });
  convo.next();
}

// confirm check in time with user
function confirmCheckInTime(response, convo) {
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;

  var SlackUserId = response.user;
  var now = (0, _moment2.default)();

  console.log("\n\n ~~ message in confirmCheckInTime ~~ \n\n");

  // use Wit to understand the message in natural language!
  var entities = response.intentObject.entities;

  var checkinTimeObject; // moment object of time
  var checkinTimeString; // format to display (`h:mm a`)
  var checkinTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)

  // user has only put in a time. need to get a note next
  if (entities.duration || entities.custom_time) {
    if (entities.duration) {

      var durationArray = entities.duration;
      var durationSeconds = 0;
      for (var i = 0; i < durationArray.length; i++) {
        durationSeconds += durationArray[i].normalized.value;
      }
      var durationMinutes = Math.floor(durationSeconds / 60);

      // add minutes to now
      checkinTimeObject = (0, _moment2.default)().add(durationSeconds, 'seconds');
      checkinTimeString = checkinTimeObject.format("h:mm a");
    } else if (entities.custom_time) {
      // get rid of timezone to make it tz-neutral
      // then create a moment-timezone object with specified timezone
      var timeStamp = entities.custom_time[0].value;
      timeStamp = (0, _moment2.default)(timeStamp); // in PST because of Wit default settings

      timeStamp.add(timeStamp._tzm - now.utcOffset(), 'minutes');
      // create time object based on user input + timezone

      checkinTimeObject = timeStamp;
      checkinTimeString = checkinTimeObject.format("h:mm a");
    }
    convo.sessionStart.checkinTimeObject = checkinTimeObject;
    convo.sessionStart.checkinTimeString = checkinTimeString;
    askForReminderDuringCheckin(response, convo);
  } else if (entities.reminder) {

    finalizeCheckinTimeToStart(response, convo);
  } else {
    // CURRENT WE ARE NOT HANDLING THIS
    console.log("\n\n ~~ failure in confirmCheckInTime ~~ \n\n");
    console.log(response);
    console.log("\n\n");
    convo.repeat();
    convo.next();
  }
}

function askForReminderDuringCheckin(response, convo) {
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;

  var SlackUserId = response.user;

  convo.say("Last thing - is there anything you'd like me to remind you during the check in?");
  convo.ask("This could be a note like `call Eileen` or `should be on the second section of the proposal by now`", [{
    pattern: _botResponses.utterances.yes,
    callback: function callback(response, convo) {
      convo.ask('What note would you like me to remind you about?', function (response, convo) {
        getReminderNoteFromUser(response, convo);
        convo.next();
      });

      convo.next();
    }
  }, {
    pattern: _botResponses.utterances.no,
    callback: function callback(response, convo) {
      convo.next();
    }
  }, {
    default: true,
    callback: function callback(response, convo) {
      // we are assuming anything else is the reminderNote
      getReminderNoteFromUser(response, convo);
      convo.next();
    }
  }], { 'key': 'reminderNote' });
}

function getReminderNoteFromUser(response, convo) {
  var task = convo.task;
  var bot = task.bot;
  var source_message = task.source_message;

  var SlackUserId = response.user;

  var note = response.text;

  var _convo$sessionStart5 = convo.sessionStart;
  var checkinTimeObject = _convo$sessionStart5.checkinTimeObject;
  var checkinTimeString = _convo$sessionStart5.checkinTimeString;


  convo.ask('Does this look good: `' + note + '`?', [{
    pattern: _botResponses.utterances.yes,
    callback: function callback(response, convo) {

      convo.sessionStart.reminderNote = note;
      convo.next();
    }
  }, {
    pattern: _botResponses.utterances.no,
    callback: function callback(response, convo) {
      convo.ask('Just tell me a one-line note and I\'ll remind you about it at ' + checkinTimeString + '!', function (response, convo) {
        getReminderNoteFromUser(response, convo);
        convo.next();
      });
      convo.next();
    }
  }]);
}
//# sourceMappingURL=index.js.map