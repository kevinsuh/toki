import os from 'os';
import { numberLessThanTen, numberGreaterThanTen } from '../../middleware/hearMiddleware';
import { helloResponse, randomInt } from '../../lib/botResponses';
import { wit } from '../../index';

// base controller
export default function(controller) {

	/**
	 * 		INDEX functions of tasks
	 */
	
	 /**
	  * 	START OF YOUR DAY
	  */

	// this is only for start_day parsed intent from wit
	// we are relying on wit to do all of the NL parsing for us
	// so that it normalizes into intent strings for us to decipher
	// instead of reg ex
	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {
		bot.reply(message, "Okay let's start the day then!");
	});

};