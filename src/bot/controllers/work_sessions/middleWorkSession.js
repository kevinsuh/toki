import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

// MIDDLE OF A WORK SESSION
export default function(controller) {

	/**
	 * 		DURING A WORK SESSION
	 * 		
	 * 		extend work session
	 * 		cross out tasks
	 * 		ask how much time left
	 * 		
	 */

	// EXTEND AN EXISTING WORK SESSION
	controller.hears(['extend_session'], 'direct_message', wit.hears, (bot, message) => {

		console.log("extending session!");
		console.log(JSON.stringify(message.intentObject));

		// these are array of objects
		const { session_duration, extend_to } = message.intentObject.entities;
		var now = moment();

		console.log("here extending session");
		
		// var timezone = String(String(now.utc()._d).split("(")[1]).split(")")[0];

		// this means user requested duration extension (i.e. 10 more minutes)
		if (session_duration) {
			
			var durationSeconds = 0;
			for (var i = 0; i < session_duration.length; i++) {
				durationSeconds += session_duration[i].normalized.value;
			}
			var durationMinutes = Math.floor(durationSeconds / 60);

			var extendedTime = now.add(durationSeconds, 'seconds');
			extendedTime = extendedTime.format('h:mm a');

			bot.reply(message, `Okay, ${durationMinutes} minutes added :timer_clock: . See you at ${extendedTime}!`);

		} else if (extend_to) {

			var extendToTimestamp = extend_to[0].to.value;
			extendToTimestamp     = moment(extendToTimestamp); // in PST because of Wit default settings

			extendToTimestamp.add(extendToTimestamp._tzm - now.utcOffset(), 'minutes'); // convert from PST to local TZ

			var extendedTime = extendToTimestamp.format('h:mm a');

			bot.reply(message, `Okay, see you at ${extendedTime} :timer_clock:!`);

		} else {

			bot.reply(message, `Sorry, didn't catch that. How long do you want to extend your session for?`);
		}

	});

};