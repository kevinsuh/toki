import os from 'os';
import { wit } from '../index';
import moment from 'moment';

import models from '../../../app/models';

// base controller for reminders
export default function(controller) {

	/**
	 * 		INDEX functions of reminders
	 */
	
	// EXTEND AN EXISTING WORK SESSION
	controller.hears(['custom_reminder'], 'direct_message', wit.hears, (bot, message) => {

		console.log("setting a custom reminder!");
		console.log(JSON.stringify(message.intentObject));

		// these are array of objects
		const { reminder, reminder_text, reminder_time, reminder_duration } = message.intentObject.entities;

		// catch the failure
		if (!reminder_duration && !reminder_time) {
			bot.reply(message, `Sorry, didn't catch that. Can you say that again? :dog:`);
			return;
		}

		var now = moment();

		// get custom note
		var customNote = null;
		if (reminder_text) {
			customNote = reminder_text[0].value;
		} else if (reminder) {
			customNote = reminder[0].value;
		}

		const SlackUserId = message.user;

		var remindTimeStamp; // for the message (`h:mm a`)
		var remindTimeStampForDB; // for DB (`YYYY-MM-DD HH:mm:ss`)
		if (reminder_duration) { // i.e. ten more minutes
			console.log("inside of reminder_duration\n\n\n\n");
			var durationSeconds = 0;
			for (var i = 0; i < reminder_duration.length; i++) {
				durationSeconds += reminder_duration[i].normalized.value;
			}
			var durationMinutes = Math.floor(durationSeconds / 60);

			remindTimeStamp = now.add(durationSeconds, 'seconds');
			
		} else if (reminder_time) { // i.e. `at 3pm`
			console.log("inside of reminder_time\n\n\n\n");
			remindTimeStamp = reminder_time[0].value;
			remindTimeStamp = moment(remindTimeStamp); // in PST because of Wit default settings

			remindTimeStamp.add(remindTimeStamp._tzm - now.utcOffset(), 'minutes'); // convert from PST to local TZ
		}

		// insert into DB and send message

		remindTimeStampForDB = remindTimeStamp.format('YYYY-MM-DD HH:mm:ss');
		remindTimeStamp      = remindTimeStamp.format('h:mm a');

		// find user then reply
		models.SlackUser.find({
			where: { SlackUserId }
		})
		.then((slackUser) => {
			models.Reminder.create({
				remindTime: remindTimeStampForDB,
				UserId: slackUser.UserId,
				customNote
			})
			.then((reminder) => {
				bot.reply(message, `Okay, :alarm_clock: set. See you at ${remindTimeStamp}!`);
			});
		});

	});
}
