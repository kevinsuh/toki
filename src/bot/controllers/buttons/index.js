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
			switch (actions[0].name) {
				case buttonValues.startNow.name:
					break;
				case buttonValues.checkIn.name:
					break;
				case buttonValues.changeTask.name:
					bot.replyInteractive(message, "Let's give this another try then :repeat_one:");
					break;
				case buttonValues.changeTime.name:
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