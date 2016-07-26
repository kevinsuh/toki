import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';
import dotenv from 'dotenv';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, timeZones, tokiOptionsAttachment } from '../../lib/constants';
import { dateStringToMomentTimeZone, witTimeResponseToTimeZoneObject, witDurationToMinutes, witDurationToTimeZoneObject, prioritizeDailyTasks } from '../../lib/miscHelpers';
import { convertMinutesToHoursString } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

import { resumeQueuedReachouts } from '../index';

// user wants to update settings!
export default function(controller) {

	/**
	 *      SLASH COMMAND FLOW
	 */

	controller.on('slash_command', (bot, message) => {

		const SlackUserId = message.user;
		let env           = process.env.NODE_ENV || 'development';

		if (env == "development") {
			message.command = message.command.replace("_dev","");
		}

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
				resumeQueuedReachouts(bot, { SlackUserId });
				return;
			}

			user.getDailyTasks({
				where: [`"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live"],
				include: [ models.Task ],
				order: `"DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {

				const { intentObject: { entities: { reminder, duration, datetime } } } = message;

				let now = moment();
				let responseObject = {
					response_type: "in_channel"
				}

				let customTimeObject;
				switch (message.command) {
					case "/add":
						/*
						{"msg_id":"c02a017f-10d5-4b24-ab74-ee85c8955b42","_text":"clean up room for 30 minutes","entities":{"reminder":[{"confidence":0.9462485198304393,"entities":{},"type":"value","value":"clean up room","suggested":true}],"duration":[{"confidence":0.9997298403843689,"minute":30,"value":30,"unit":"minute","normalized":{"value":1800,"unit":"second"}}]}}
					 */

						let totalMinutes = 0;
						dailyTasks.forEach((dailyTask, index) => {
							let { dataValues: { minutes } } = dailyTask;
							totalMinutes += minutes;
						});

						let text = reminder ? reminder[0].value : message.text;

						if (text == '') text = null; // cant have blank text

						customTimeObject = witTimeResponseToTimeZoneObject(message, tz);

						if (text && customTimeObject) {

							// quick adding a task requires both text + time!
							
							let minutes;
							if (duration) {
								minutes = witDurationToMinutes(duration);
							} else { // datetime
								minutes = parseInt(moment.duration(customTimeObject.diff(now)).asMinutes());
							}

							// we have the task and minutes, create task now
							let newPriority = dailyTasks.length + 1;
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

									prioritizeDailyTasks(user);

									totalMinutes += minutes;
									let timeString = convertMinutesToHoursString(totalMinutes);
									
									responseObject.text = `Nice, I added \`${text} (${minutes} min)\` to your task list! You have ${timeString} of work remaining over ${newPriority} tasks :muscle:`;
									bot.replyPublic(message, responseObject);

								})
							});

						} else {

							let responseText = '';
							if (text) {
								responseText = `Hey, I need to know how long you want to work on \`${text}\` for! (please say \`${text} for 30 min\` or \` ${text} until 3pm\`)`;
							} else {
								responseText = `Hey, I need to know what task you want to add \`i.e. clean market report for 30 minutes\`!`;
							}
							responseObject.text = responseText;
							bot.replyPublic(message, responseObject);

						}

						break;
					case "/note":

						let customNote = reminder ? reminder[0].value : null;

						customTimeObject = witTimeResponseToTimeZoneObject(message, tz);

						if (customTimeObject) {

							// quick adding a reminder requires both text + time!
							models.Reminder.create({
								remindTime: customTimeObject,
								UserId,
								customNote
							})
							.then((reminder) => {
								let customTimeString = customTimeObject.format('h:mm a');
								let responseText = `Okay, I'll remind you at ${customTimeString}`;
								if (customNote) {
									responseText = `${responseText} about \`${customNote}\``;
								}
								responseText = `${responseText}! :alarm_clock:`;
								responseObject.text = responseText;
								bot.replyPublic(message, responseObject);
							});

						} else {
							let responseText = '';
							if (customNote) {
								responseText = `Hey, I need to know what time you want me to remind you about \`${text}\` (please say \`${text} in 30 min\` or \`${text} at 7pm\`)!`;
							} else {
								responseText = `Hey, I need to know when you want me to remind you \`i.e. pick up clothes at 7pm\`!`;
							}
							responseObject.text = responseText;
							bot.replyPublic(message, responseObject);
						}

						break;
					case "/help":
					default:
						responseObject.text = `I'm sorry, still learning how to \`${message.command}\`! :dog:`;
						bot.replyPublic(message, responseObject);
						break;
				}
				resumeQueuedReachouts(bot, { SlackUserId });
			})


		});

	});

}
