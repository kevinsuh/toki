import os from 'os';
import { wit } from '../../index';
import moment from 'moment-timezone';

// END OF A WORK SESSION
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

		bot.reply(message, "Excellent work :sports_medal:!");

		

	});


};