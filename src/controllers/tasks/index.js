import os from 'os';
import { wit } from '../../index';

// base controller for tasks
export default function(controller) {

	/**
	 * 		INDEX functions of tasks
	 */
	
	/**
	* 	START OF YOUR DAY
	*/

	// we are relying on wit to do all of the NL parsing for us
	// so that it normalizes into `intent` strings for us to decipher
	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {
		bot.reply(message, "Okay let's start the day then!");
	});

};