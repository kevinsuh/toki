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
					bot.replyInteractive(message, "I'd love to check in with you! Leave a note in the same line if you want me to remember it (`i.e. halfway done by 4pm`)");
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
				case buttonValues.newTask.value:
					bot.replyInteractive(message, "Sweet! Let's work on a new task");
					break;
				case buttonValues.addCheckinNote.value:
					bot.replyInteractive(message, "Let's add a note to your checkin!");
					break;
				case buttonValues.takeBreak.value:
					bot.replyInteractive(message, "Let's take a break!");
					break;
				case buttonValues.noTasks.value:
					bot.replyInteractive(message, "No worries! :smile_cat:");
					break;
				case buttonValues.noPendingTasks.value:
					bot.replyInteractive(message, "I like a fresh start each day, too :tangerine:");
					break;
				case buttonValues.noAdditionalTasks.value:
					bot.replyInteractive(message, "Sounds good!");
					break;
				case buttonValues.backLater.value:
					bot.replyInteractive(message, "Okay! I'll be here when you get back");
					break;
				case buttonValues.actuallyWantToAddATask.value:
					bot.replyInteractive(message, "Of course - just add another task here and say `done` when you're ready to go");
				break;
				case buttonValues.differentTask.value:
					bot.replyInteractive(message, "What did you get done instead?");
					break;
				case buttonValues.keepName.value:
					bot.replyInteractive(message, "Cool!")
					break;
				case buttonValues.differentName.value:
					bot.replyInteractive(message, "Let's do another name then!")
					break;
				case buttonValues.changeTimeZone.value:
					bot.replyInteractive(message, "Let's change your timezone!")
					break;
				case buttonValues.changeName.value:
					bot.replyInteractive(message, "Let's change your name!")
					break;
				case buttonValues.neverMind.value:
					bot.replyInteractive(message, "Sounds good")
					break;
				case buttonValues.startDay.value:
					bot.replyInteractive(message, "Let's do it!")
					break;
				case buttonValues.startSession.value:
					bot.replyInteractive(message, "Let's kick off a new session :soccer:")
					break;
				case buttonValues.endDay.value:
					bot.replyInteractive(message, "It's about that time, isn't it?")
					break;
				case buttonValues.resetTimes.value:
					bot.replyInteractive(message, "_Resetting :repeat:..._")
					break;
				case buttonValues.snooze.value:
					bot.replyInteractive(message, "Okay, snoozing!")
					console.log("\n\n\nTHIS IS BOT:");
					console.log(bot);
					console.log("\n\n\n");
					controller.trigger(`snooze_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				default:
					// some default to replace button no matter what
					bot.replyInteractive(message, "Awesome!");
			}
		}

	})


};