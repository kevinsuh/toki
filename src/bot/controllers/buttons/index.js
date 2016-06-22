import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

// base controller for "buttons" flow
export default function(controller) {

	console.log("\n\n ~~ buttons controller initiated .. ~~ \n\n");
	
	// receive an interactive message via button click
	// check message.actions and message.callback_id to see the action to take
	controller.on(`interactive_message_callback`, (bot, message) => {

		console.log("\n\n\n ~~ inside interactive_message_callback ~~ \n\n\n");
		console.log(message);
		console.log("\n\n\n");

		bot.replyInteractive(message, {
			text: "...!?!?...",
			callback_id: "123",
			attachment_type: "default",
			actions: [
				{
					name: "another button!",
					text: "yay button",
					value: "yes ok",
					type: "button",
					style: "danger",
					confirm: {
						title: "You sure?",
						text: "This will do something!",
						ok_text: "Yesss",
						dismiss_text: "NAH!"
					}
				}
			]
		});

	})

};