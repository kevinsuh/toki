import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { buttonValues } from '../../lib/constants';
import moment from 'moment-timezone';

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
					bot.replyInteractive(message, "I like a fresh start each day, too");
					break;
				case buttonValues.noAdditionalTasks.value:
					bot.replyInteractive(message, "Sounds good!");
					break;
				case buttonValues.backLater.value:
					bot.replyInteractive(message, "Okay! I'll be here when you get back");
					break;
				case buttonValues.actuallyWantToAddATask.value:
					bot.replyInteractive(message, "Let's add more tasks! Enter them here separated by new lines");
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
					bot.replyInteractive(message, ":boom: boom")
					break;
				case buttonValues.endDay.value:
					bot.replyInteractive(message, "It's about that time, isn't it?")
					break;
				case buttonValues.resetTimes.value:
					break;
				case buttonValues.doneSessionTimeoutYes.value:
					bot.replyInteractive(message, "Great work! :raised_hands:")
					controller.trigger(`done_session_yes_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.doneSessionTimeoutSnooze.value:
					models.User.find({
						where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
						include: [
							models.SlackUser
						]
					})
					.then((user) => {
						bot.replyInteractive(message, `Keep at it!`);
						controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId, botCallback: true }]);
					});
					break;
				case buttonValues.doneSessionTimeoutDidSomethingElse.value:
					bot.replyInteractive(message, `Woo! :ocean:`);
					controller.trigger(`end_session`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.doneSessionTimeoutNo.value:
					bot.replyInteractive(message, `That's okay! You can keep chipping away and you'll get there :pick:`);
					controller.trigger(`done_session_no_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.doneSessionEarlyNo.value:
					bot.replyInteractive(message, `Got it`)
					break;
				case buttonValues.doneSessionYes.value:
					bot.replyInteractive(message, "Great work! :raised_hands:")
					break;
				case buttonValues.doneSessionSnooze.value:
					bot.replyInteractive(message, `Keep at it!`);
					break;
				case buttonValues.doneSessionDidSomethingElse.value:
					bot.replyInteractive(message, `:ocean: Woo!`);
					break;
				case buttonValues.doneSessionNo.value:
					bot.replyInteractive(message, `That's okay! You can keep chipping away and you'll get there :pick:`);
					break;
				case buttonValues.thatsCorrect.value:
					bot.replyInteractive(message, `Fantastic!`);
					break;
				case buttonValues.thatsIncorrect.value:
					bot.replyInteractive(message, `Oops, okay! Let's get this right`);
					break;
				case buttonValues.addTask.value:
					bot.replyInteractive(message, `Added! Keep at it :muscle:`);
					break;
				case buttonValues.changeTaskContent.value:
					bot.replyInteractive(message, `Let's change the task then!`);
					break;
				case buttonValues.changeTaskTime.value:
					bot.replyInteractive(message, `Let's change the time then!`);
					break;
				case buttonValues.editTaskList.value:
					bot.replyInteractive(message, `Okay! Let's edit your task list`);
					break;
				case buttonValues.addTasks.value:
					bot.replyInteractive(message, `Boom! Let's add some tasks :muscle:`);
					break;
				case buttonValues.markComplete.value:
					bot.replyInteractive(message, `Woo! Let's check off some tasks :grin:`);
					break;
				case buttonValues.deleteTasks.value:
					bot.replyInteractive(message, `Okay! Let's remove some tasks`);
					break;
				case buttonValues.neverMindTasks.value:
					bot.replyInteractive(message, "Okay! I didn't do anything :smile_cat:")
					break;
				case buttonValues.editTaskTimes.value:
					bot.replyInteractive(message, "Let's do this :hourglass:");
					break;
				case buttonValues.newSession.value:
					bot.replyInteractive(message, "Let's do this :baby:");
					break;
				case buttonValues.cancelSession.value:
					bot.replyInteractive(message, "No worries! We'll get that done soon");
					break;
				default:
					// some default to replace button no matter what
					bot.replyInteractive(message, "Awesome!");
			}
		}

	})


};