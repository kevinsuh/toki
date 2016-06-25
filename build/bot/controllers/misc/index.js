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

    var SECRET_KEY = new RegExp(/^TOKI_T1ME/);

    // user said something outside of wit's scope
    if (!message.selectedIntent) {

      bot.send({
        type: "typing",
        channel: message.channel
      });
      setTimeout(function () {

        // different fallbacks based on reg exp
        var text = message.text;


        if (_constants.THANK_YOU.reg_exp.test(text)) {
          // user says thank you
          bot.reply(message, "You're welcome!! :smile:");
        } else if (SECRET_KEY.test(text)) {

          console.log("\n\n ~~ UNLOCKED TOKI T1ME ~~ \n\n");

          console.log(" message being passed in:");
          console.log(message);
          console.log("\n\n\n");

          /*
              
          *** ~~ TOP SECRET PASSWORD FOR TESTING FLOWS ~~ ***
              
           */

          // startWorkSessionTest(bot, message);
          allTimeZonesTest(bot, message);
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
  });
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function allTimeZonesTest(bot, message) {

  // these are array of objects
  var _message$intentObject = message.intentObject.entities;
  var reminder = _message$intentObject.reminder;
  var custom_time = _message$intentObject.custom_time;
  var duration = _message$intentObject.duration;
  var reminder_text = _message$intentObject.reminder_text;
  var reminder_duration = _message$intentObject.reminder_duration;

  var SlackUserId = message.user;

  var text = message.text;


  var pacificTime = "America/Los_Angeles";
  var centralTime = "America/Chicago";
  var testPacific = false;
  var testCentral = false;

  if (text.includes("PACIFIC")) {
    testPacific = true;
  } else if (text.includes("CENTRAL")) {
    testCentral = true;
  }

  var now = (0, _momentTimezone2.default)();

  // get custom note
  var customNote = null;
  if (reminder_text) {
    customNote = reminder_text[0].value;
  } else if (reminder) {
    customNote = reminder[0].value;
  }

  var reminderDuration = duration;
  if (reminder_duration) {
    reminderDuration = reminder_duration;
  }

  var remindTimeStamp; // for the message (`h:mm a`)
  if (reminderDuration) {
    // i.e. ten more minutes
    console.log("inside of reminder_duration\n\n\n\n");
    var durationSeconds = 0;
    for (var i = 0; i < reminderDuration.length; i++) {
      durationSeconds += reminderDuration[i].normalized.value;
    }
    var durationMinutes = Math.floor(durationSeconds / 60);

    remindTimeStamp = now.add(durationSeconds, 'seconds');
  } else if (custom_time) {
    // i.e. `at 3pm`
    console.log("inside of reminder_time\n\n\n\n");
    remindTimeStamp = custom_time[0].value; // 2016-06-24T16:24:00.000-04:00
    console.log("wit remind timestamp:");
    console.log(remindTimeStamp);
    console.log("\n\n");

    remindTimeStamp = (0, _miscHelpers.dateStringWithoutTimeZone)(remindTimeStamp); // 2016-06-24T16:24:00.000 (no timezone attached)
    console.log("without time zone: ");
    console.log(remindTimeStamp);

    if (testPacific) {
      console.log("\n\n ~~ Testing Pacific time: ~~ \n\n");
      remindTimeStamp = _momentTimezone2.default.tz(remindTimeStamp, pacificTime);
    } else if (testCentral) {
      console.log("\n\n ~~ Testing Central time: ~~ \n\n");
      remindTimeStamp = _momentTimezone2.default.tz(remindTimeStamp, centralTime);
    }

    console.log("remind time stamp to go in db:");
    console.log(remindTimeStamp.toString());
  }

  if (remindTimeStamp) {

    var remindTimeStampString = remindTimeStamp.format('h:mm a');

    // find user then reply
    _models2.default.SlackUser.find({
      where: { SlackUserId: SlackUserId }
    }).then(function (slackUser) {
      _models2.default.Reminder.create({
        remindTime: remindTimeStamp,
        UserId: slackUser.UserId,
        customNote: customNote
      }).then(function (reminder) {
        bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
          convo.say('Okay, :alarm_clock: set. See you at ' + remindTimeStampString + '!');
          convo.next();
        });
      });
    });
  } else {

    /**
     *      TERRIBLE CODE BELOW
     *        THIS MEANS A BUG HAPPENED
     *  ~~  HOPEFULLY THIS NEVER COMES UP EVER ~~
     */

    // this means bug happened
    // hopefully this never comes up
    bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
      convo.ask("Sorry, still learning :dog:. Please let me know the time that you want a reminder `i.e. 4:51pm`", function (response, convo) {
        var entities = response.intentObject.entities;
        var reminder = entities.reminder;
        var duration = entities.duration;
        var custom_time = entities.custom_time;


        console.log("inside of reminder_time\n\n\n\n");
        var remindTime = custom_time;
        if (!remindTime) {
          convo.say("Ah I'm sorry. Still not getting you :thinking_face:");
          convo.repeat();
          convo.next();
        } else {
          remindTimeStamp = remindTime[0].value;
          console.log("wit remind timestamp:");
          console.log(remindTimeStamp);
          console.log("\n\n");

          remindTimeStamp = (0, _miscHelpers.dateStringWithoutTimeZone)(remindTimeStamp); // 2016-06-24T16:24:00.000 (no timezone attached)
          console.log("without time zone: ");
          console.log(remindTimeStamp);

          if (testPacific) {
            console.log("\n\n ~~ Testing Pacific time: ~~ \n\n");
            remindTimeStamp = _momentTimezone2.default.tz(remindTimeStamp, pacificTime);
          } else if (testCentral) {
            console.log("\n\n ~~ Testing Central time: ~~ \n\n");
            remindTimeStamp = _momentTimezone2.default.tz(remindTimeStamp, centralTime);
          }

          console.log("remind time stamp to go in db:");
          console.log(remindTimeStamp.toString());

          var remindTimeStampString = remindTimeStamp.format('h:mm a');

          // find user then reply
          _models2.default.SlackUser.find({
            where: { SlackUserId: SlackUserId }
          }).then(function (slackUser) {
            _models2.default.Reminder.create({
              remindTime: remindTimeStamp,
              UserId: slackUser.UserId,
              customNote: customNote
            }).then(function (reminder) {
              convo.say('Okay, :alarm_clock: set. See you at ' + remindTimeStampString + '!');
              convo.next();
            });
          });
        }
      });
    });
  }
}

function TEMPLATE_FOR_TEST(bot, message) {

  var SlackUserId = message.user;

  _models2.default.User.find({
    where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
    include: [_models2.default.SlackUser]
  }).then(function (user) {

    bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

      var name = user.nickName || user.email;

      // on finish convo
      convo.on('end', function (convo) {});
    });
  });
}
//# sourceMappingURL=index.js.map