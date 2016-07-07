import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, RESET, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, FINISH_WORD, EXIT_EARLY_WORDS, NONE } from '../../lib/constants';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

export default function(controller) {

	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		consoleLog("in back up area!!!", message);

		var SECRET_KEY = new RegExp(/^TOKI_T1ME/);

		// user said something outside of wit's scope
		if (!message.selectedIntent) {

			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(() => {

				// different fallbacks based on reg exp
				const { text } = message;

				if (THANK_YOU.reg_exp.test(text)) {
					// user says thank you
					bot.reply(message, "You're welcome!! :smile:");
				} else if (SECRET_KEY.test(text)) {

					consoleLog("UNLOCKED TOKI_T1ME!!!");
					/*
							
			*** ~~ TOP SECRET PASSWORD FOR TESTING FLOWS ~~ ***
							
					 */
					controller.trigger(`test_begin_day_flow`, [ bot, { SlackUserId } ]);

				} else {
					// end-all fallback
					var options = [ { title: 'start a day', description: 'get started on your day' }, { title: 'start a session', description: 'start a work session with me' }, { title: 'end session early', description: 'end your current work session with me' }];
					var colorsArrayLength = colorsArray.length;
					var optionsAttachment = options.map((option, index) => {
						var colorsArrayIndex = index % colorsArrayLength;
						return {
							fields: [
								{
									title: option.title,
									value: option.description
								}
							],
							color: colorsArray[colorsArrayIndex].hex,
							attachment_type: 'default',
							callback_id: "SHOW OPTIONS",
							fallback: option.description
						};
					});

					bot.reply(message, {
						text: "Hey! I can only help you with a few things. Here's the list of things I can help you with:",
						attachments: optionsAttachment
					});
				}

			}, 1000);

		}

	});

	/**
	 *      START DAY W/ EDITABLE MESSAGES FLOW
	 */
	
	controller.on('test_begin_day_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name   = user.nickName || user.email;
				convo.name = name;

				convo.dayStart = {
					bot,
					UserId: user.id,
					startDayDecision: false, // what does user want to do with day
					prioritizedTaskArray: [] // the final tasks to do for the day
				}

				// live or pending tasks, that are not completed yet
				user.getDailyTasks({
					where: [`"DailyTask"."type" in (?) AND "Task"."done" = ?`, ["pending", "live"], false ],
					include: [ models.Task ]
				})
				.then((dailyTasks) => {

					if (dailyTasks.length == 0) {
						// no pending tasks -- it's a new day
						askForDayTasks(err, convo);
					} else {
						// has pending tasks
						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
						convo.dayStart.pendingTasks = dailyTasks;
						showPendingTasks(err, convo);
					}

				});

				// on finish conversation
				convo.on('end', (convo) => {

					var responses = convo.extractResponses();
					const { dayStart } = convo;

					console.log('done!')
					console.log("here is day start object:\n\n\n");
					console.log(convo.dayStart);
					console.log("\n\n\n");

				});

			});

		})

	});

}

/