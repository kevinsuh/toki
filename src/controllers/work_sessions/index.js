import os from 'os';
import { wit } from '../../index';
import moment from 'moment-timezone';

// base controller for work sessions
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	/**
	 * 		FINISHING A WORK SESSION BY COMMAND
	 */
	
	// we are relying on wit to do all of the NL parsing for us
	// so that it normalizes into `intent` strings for us to decipher
	controller.hears(['done_session'], 'direct_message', wit.hears, (bot, message) => {

		// when done with session
		// 1. Great work {name}!
		// 2. What would you like to remember about this session? This could be something specific about what you got done, or more general notes about how you felt
		// 3. Awesome :) Which tasks did you complete? I'll update your list
		// 4. show task list
		// 5. get numbers to then cross out task list. CROSS TASK LIST BY EDITING MESSAGE
		// 6. Lastly, how did that session feel? (put the 4 emojis)
		// 7. Would you like to take a break? Or just respond to what user says

		bot.reply(message, "Okay you're done with session then!");

	});

	// EXTEND AN EXISTING WORK SESSION
	controller.hears(['extend_session'], 'direct_message', wit.hears, (bot, message) => {

		console.log("extending session!");
		console.log(JSON.stringify(message.intentObject));

		// these are array of objects
		const { duration, extend_to } = message.intentObject.entities;
		var now = moment();

		console.log("here extending session");
		
		// var timezone = String(String(now.utc()._d).split("(")[1]).split(")")[0];

		// this means user requested duration extension (i.e. 10 more minutes)
		if (duration) {
			
			var durationSeconds = 0;
			for (var i = 0; i < duration.length; i++) {
				durationSeconds += duration[i].normalized.value;
			}
			var durationMinutes = Math.floor(durationSeconds / 60);

			var extendedTime = now.add(durationSeconds, 'seconds');
			extendedTime = extendedTime.format('h:mm a');

			bot.reply(message, `Okay, ${durationMinutes} minutes added. See you at ${extendedTime}!`);

		} else if (extend_to) {

			var extendToTimestamp = extend_to[0].to.value;
			extendToTimestamp     = moment(extendToTimestamp); // in PST because of Wit default settings

			extendToTimestamp.add(extendToTimestamp._tzm - now.utcOffset(), 'minutes'); // convert from PST to local TZ

			var extendedTime = extendToTimestamp.format('h:mm a');

			bot.reply(message, `Okay, see you at ${extendedTime}!`);

		} else {

			bot.reply(message, `Sorry, didn't catch that. How long do you want to extend your session for?`);
		}

	});

};