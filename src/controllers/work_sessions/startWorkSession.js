import os from 'os';
import { wit } from '../../index';
import moment from 'moment-timezone';

// START OF A WORK SESSION
export default function(controller) {

	/**
	 * 		STARTING A WORK SESSION
	 * 		
	 * 		start work session
	 * 		show tasks
	 * 		tell what time you will end at
	 * 		
	 */

	// EXTEND AN EXISTING WORK SESSION
	controller.hears(['start_session'], 'direct_message', wit.hears, (bot, message) => {

		console.log("starting session!");
		console.log(JSON.stringify(message.intentObject));
		console.log("bot here\n\n\n\n\n\n");
		console.log(bot);

		var oneMinute = 60000; // ms to minutes
		var sessionMinutes = 1;
		var sessionTotalTime = sessionMinutes * oneMinute;

		if (typeof bot.timer !== undefined)
			clearTimeout(bot.timer);

		bot.timer = setTimeout(() => {
			bot.reply(message, `Time's up! :timer_clock: let me know when you're ready to move on.`);
		}, sessionTotalTime);

		bot.reply(message, `Okay, :timer_clock: started. See you in ${sessionMinutes} minutes`);


	});

};