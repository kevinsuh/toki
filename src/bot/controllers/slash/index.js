import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';
import dotenv from 'dotenv';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, timeZones, tokiOptionsAttachment } from '../../lib/constants';
import { dateStringToMomentTimeZone, witTimeResponseToTimeZoneObject, witDurationToMinutes, witDurationToTimeZoneObject} from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { resumeQueuedReachouts } from '../index';

// user wants to update settings!
export default function(controller) {

	/**
	 *      SLASH COMMAND FLOW
	 */

	controller.on('slash_command', (bot, message) => {

		/*
			{ token: '1kKzBPfFPOujZiFajN9uRGFe',
				team_id: 'T121VLM63',
				team_domain: 'tokihq',
				channel_id: 'D1J6A98JC',
				channel_name: 'directmessage',
				user_id: 'U121ZK15J',
				user_name: 'kevinsuh',
				command: '/add',
				text: 'clean up room for 30 minutes',
				response_url: 'https://hooks.slack.com/commands/T121VLM63/61639805698/tDr69qc5CsdXdQTaugljw0oP',
				user: 'U121ZK15J',
				channel: 'D1J6A98JC',
				type: 'slash_command',
				intentObject:
				 { msg_id: 'c02a017f-10d5-4b24-ab74-ee85c8955b42',
					 _text: 'clean up room for 30 minutes',
				 entities: { reminder: [Object], duration: [Object] } } }
	  */
		/*
			{"msg_id":"c02a017f-10d5-4b24-ab74-ee85c8955b42","_text":"clean up room for 30 minutes","entities":{"reminder":[{"confidence":0.9462485198304393,"entities":{},"type":"value","value":"clean up room","suggested":true}],"duration":[{"confidence":0.9997298403843689,"minute":30,"value":30,"unit":"minute","normalized":{"value":1800,"unit":"second"}}]}}
		 */

		const SlackUserId = message.user;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const { nickName, SlackUser: { tz } } = user;
			const UserId = user.id;

			// make sure verification token matches!
			if (message.token !== process.env.VERIFICATION_TOKEN) {
				console.log(`\n ~~ verification token could not be verified ~~ \n`)
				return;
			}

			user.getDailyTasks({
				where: [`"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live"],
				include: [ models.Task ],
				order: `"DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {

				var now = moment();

				switch (message.command) {
					case "/add":
						const { intentObject: { entities: { reminder, duration, datetime } } } = message;

						if (reminder) {

							var text = reminder[0].value;
							var customTimeObject = witTimeResponseToTimeZoneObject(message, tz);

							if (customTimeObject) {
								var minutes;
								if (duration) {
									minutes = witDurationToMinutes(duration);
								} else {
									minutes = moment.duration(customTimeObject.diff(now)).asMinutes();
								}

								// we have the task and minutes, create task now
								var newPriority = dailyTasks.length + 1;
								models.Task.create({
									text
								})
								.then((task) => {
									models.DailyTask.create({
										TaskId: task.id,
										priority: newPriority,
										minutes,
										UserId
									})
									.then(() => {
										bot.replyPrivate(message, `Nice, I added \`${text} (${minutes} min)\` to your task list! You have ${newPriority} tasks remaining for today :muscle:`);
									})
								});

							} else {
								bot.replyPrivate(message, `Hey, I need to know how long you want to work on \`${text}\` for, either \`for 30 min\` or \`until 3pm\`!`);
							}

						} else {
							bot.replyPrivate(message, "Hey, I need to know what task you want to work on in order to add it!");
						}
						break;
					case "/help":
					default: 
						bot.replyPrivate(message, "I'm sorry, still learning how to " + message.command + "! :dog:");
						break;
				}

				resumeQueuedReachouts(bot, { SlackUserId });

			})


		});

	});

}
