import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';
import { buttonValues } from '../../lib/constants';

// base controller for "buttons" flow
export default function(controller) {

	// receive an interactive message via button click
	// check message.actions and message.callback_id to see the action to take
	controller.on(`interactive_message_callback`, (bot, message) => {

		console.log("\n\n\n ~~ inside interactive_message_callback ~~ \n");
		console.log("this is message:");
		console.log(message);
		console.log("\n\n\n");

		const SlackUserId = message.user;
		const { actions, callback_id } = message;

		// need to replace buttons so user cannot reclick it
		if (actions && actions.length > 0) {
			switch (actions[0].value) {
				case buttonValues.startNow.value:
					bot.replyInteractive(message, "Boom! :boom:");
					break;
				case buttonValues.checkIn.value:
					bot.replyInteractive(message, "I'd love to check in with you! Leave a note in the same line if you want me to remember a specific note");
					break;
				case buttonValues.changeTask.value:
					bot.replyInteractive(message, "Let's give this another try then :repeat_one:");
					break;
				case buttonValues.changeSessionTime.value:
					// this is when you want to have a custom time
					bot.replyInteractive(message, "Let's choose how long to work! I understand minutes (`ex. 45 min`) or specific times (`ex. 3:15pm`)");
					break;
				case buttonValues.changeCheckinTime.value:
					bot.replyInteractive(message, "I'm glad we caught this - when would you like me to check in with you?");
					break;
				default:
					// some default to replace button no matter what
					bot.replyInteractive(message, "Awesome, thanks!");
			}
		}




		// if (callback_id == "test" && actions.length > 0) {
		// 	const { name, value } = actions[0];
		// 	console.log("callback!");
		// 	console.log(actions);

		// 	if (value == "QUIT_START_DAY") {
		// 		bot.replyInteractive(message, "restarting start day!");
		// 		controller.trigger('trigger_day_start', [bot, { SlackUserId }]);
		// 	}
		// }

	})


};