import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringWithoutTimeZone } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

export default function(controller) {
  // this will send message if no other intent gets picked up
  controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

    const SlackUserId = message.user;

    console.log("\n\n\n ~~ in back up area!!! ~~ \n\n\n");
    console.log(message);

    var SECRET_KEY = new RegExp(/^TOKI_T1ME/);

    // user said something outside of wit's scope
    if (!message.selectedIntent) {

      bot.send({
        type: "typing",
        channel: message.channel
      });
      setTimeout(() => {

        // different fallbacks based on reg exp
        const { text } = message;

        if (THANK_YOU.reg_exp.test(text)) {
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

  });
}

function allTimeZonesTest(bot, message) {

  // these are array of objects
  const { reminder, custom_time, duration, reminder_text, reminder_duration } = message.intentObject.entities;
  const SlackUserId = message.user;

  var { text } = message;

  var pacificTime = "America/Los_Angeles";
  var centralTime = "America/Chicago";
  var testPacific = false;
  var testCentral = false;

  if (text.includes("PACIFIC")) {
    testPacific = true;
  } else if (text.includes("CENTRAL")) {
    testCentral = true;
  }

  var now = moment();

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
  if (reminderDuration) { // i.e. ten more minutes
    console.log("inside of reminder_duration\n\n\n\n");
    var durationSeconds = 0;
    for (var i = 0; i < reminderDuration.length; i++) {
      durationSeconds += reminderDuration[i].normalized.value;
    }
    var durationMinutes = Math.floor(durationSeconds / 60);

    remindTimeStamp = now.add(durationSeconds, 'seconds');
    
  } else if (custom_time) { // i.e. `at 3pm`
    console.log("inside of reminder_time\n\n\n\n");
    remindTimeStamp = custom_time[0].value; // 2016-06-24T16:24:00.000-04:00
    console.log("wit remind timestamp:");
    console.log(remindTimeStamp);
    console.log("\n\n");

    remindTimeStamp = dateStringWithoutTimeZone(remindTimeStamp); // 2016-06-24T16:24:00.000 (no timezone attached)
    console.log("without time zone: ");
    console.log(remindTimeStamp);


    if (testPacific) {
      console.log("\n\n ~~ Testing Pacific time: ~~ \n\n");
      remindTimeStamp = moment.tz(remindTimeStamp, pacificTime);
    } else if (testCentral) {
      console.log("\n\n ~~ Testing Central time: ~~ \n\n");
      remindTimeStamp = moment.tz(remindTimeStamp, centralTime);
    }
    
    console.log("remind time stamp to go in db:");
    console.log(remindTimeStamp.toString());
  }

  if (remindTimeStamp) {

    var remindTimeStampString = remindTimeStamp.format('h:mm a');

    // find user then reply
    models.SlackUser.find({
      where: { SlackUserId }
    })
    .then((slackUser) => {
      models.Reminder.create({
        remindTime: remindTimeStamp,
        UserId: slackUser.UserId,
        customNote
      })
      .then((reminder) => {
        bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
          convo.say( `Okay, :alarm_clock: set. See you at ${remindTimeStampString}!`);
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
    bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
      convo.ask("Sorry, still learning :dog:. Please let me know the time that you want a reminder `i.e. 4:51pm`", (response, convo) => {

        var { intentObject: { entities } } = response;
        const { reminder, duration, custom_time } = entities;

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

          remindTimeStamp = dateStringWithoutTimeZone(remindTimeStamp); // 2016-06-24T16:24:00.000 (no timezone attached)
          console.log("without time zone: ");
          console.log(remindTimeStamp);

          if (testPacific) {
            console.log("\n\n ~~ Testing Pacific time: ~~ \n\n");
            remindTimeStamp = moment.tz(remindTimeStamp, pacificTime);
          } else if (testCentral) {
            console.log("\n\n ~~ Testing Central time: ~~ \n\n");
            remindTimeStamp = moment.tz(remindTimeStamp, centralTime);
          }
          
          console.log("remind time stamp to go in db:");
          console.log(remindTimeStamp.toString());

          var remindTimeStampString = remindTimeStamp.format('h:mm a');

          // find user then reply
          models.SlackUser.find({
            where: { SlackUserId }
          })
          .then((slackUser) => {
            models.Reminder.create({
              remindTime: remindTimeStamp,
              UserId: slackUser.UserId,
              customNote
            })
            .then((reminder) => {
              convo.say( `Okay, :alarm_clock: set. See you at ${remindTimeStampString}!`);
              convo.next();
            });
          });
        }
      });
    });

  }

}

function TEMPLATE_FOR_TEST(bot, message) {

  const SlackUserId = message.user;

  models.User.find({
    where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
    include: [
      models.SlackUser
    ]
  }).then((user) => {

    bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

      var name = user.nickName || user.email;

      // on finish convo
      convo.on('end', (convo) => {
        
      });

    });
  });
}
