import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { utterances } from '../../lib/botResponses';
import { witTimeResponseToTimeZoneObject, dateStringToMomentTimeZone } from '../../lib/miscHelpers';

// base controller for reminders
export default function(controller) {

	// get reminder
	// if user did not specify reminder, then go through conversational flow about it
	controller.hears(['custom_reminder'], 'direct_message', wit.hears, (bot, message) => {

		// these are array of objects
		const { reminder, custom_time, duration } = message.intentObject.entities;
		const SlackUserId = message.user;

		var config = {
			reminder,
			custom_time,
			duration,
			SlackUserId
		};

		// if they want a reminder, just tell them how to structure it
		if (!custom_time && !duration) {
			console.log("about to ask for reminder...");
			console.log(config);
			controller.trigger(`ask_for_reminder`, [ bot, config ]);
			return;
		} else {
			// user has already specified time
			controller.trigger(`set_reminder`, [ bot, config ]);
		}

	});

	// this is conversational flow to get reminder set
	controller.on(`ask_for_reminder`, (bot, config) => {

		const { SlackUserId } = config;

		if (!SlackUserId) {
			console.log("NOT WORKING IN ask_for_reminder...");
			console.log(config);
			console.log("\n\n\n\n\n");
			return;
		}

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// get timezone of user
			const { SlackUser: { tz } } = user;

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				convo.reminderConfig = {
					SlackUserId,
					tz
				};

				convo.ask("What time would you like me to check in with you? :bellhop_bell:", (response, convo) => {

					var { intentObject: { entities } } = response;
					const { reminder, duration, custom_time } = entities;

					if (!duration && !custom_time) {
						convo.say("Sorry, still learning :dog:. Please let me know the time that you want a reminder `i.e. at 4:51pm`");
						convo.repeat();
					} else {

						convo.reminderConfig.duration    = duration;
						convo.reminderConfig.custom_time = custom_time;

						convo.say("Excellent! Would you like me to remind you about anything when I check in?");
						convo.ask("You can leave any kind of one-line note, like `call Kevin` or `follow up with Taylor about design feedback`", [
							{
								pattern: utterances.yes,
								callback: (response, convo) => {
									convo.ask(`What note would you like me to remind you about?`, (response, convo) => {
										convo.reminderConfig.reminder = [{value:response.text}];
										convo.next();
									});
									convo.next();
								}
							},
							{
								pattern: utterances.no,
								callback: (response, convo) => {
									convo.next();
								}
							},
							{
								default: true,
								callback: (response, convo) => {
									convo.reminderConfig.reminder = [{value:response.text}];
									convo.next();
								}
							}
						]);

					}

					convo.next();

				});
				convo.on('end', (convo) => {
					var config = convo.reminderConfig;
					console.log("CONFIG ON FINISH:");
					console.log(config);
					console.log("\n\n\n\n\n")
					controller.trigger(`set_reminder`, [ bot, config ]);
				})
			});

		});

			

	});

	// the actual setting of reminder
	controller.on(`set_reminder`, (bot, config) => {

		const { SlackUserId, reminder, custom_time, duration } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// get timezone of user
			const { SlackUser: { tz } } = user;
			const UserId = user.id;

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				convo.reminderObject = {
					SlackUserId,
					UserId,
					tz
				};

				var now = moment();

				// get note for reminder
				var customNote = null;
				if (reminder) {
					customNote = reminder[0].value;
				}
				convo.reminderObject.customNote = customNote;

				// this is passed in response objects, need to format it
				var responseObject = {
					intentObject: {
						entities: {
							duration,
							custom_time
						}
					}
				}
				var remindTimeStamp = witTimeResponseToTimeZoneObject(responseObject, tz);

				// if we have the time for reminder, we're good to go!
				if (remindTimeStamp) {
					
					convo.reminderObject.remindTimeStamp = remindTimeStamp;
					var remindTimeStampString = remindTimeStamp.format('h:mm a');

					convo.say( `Okay, :alarm_clock: set. See you at ${remindTimeStampString}!`);
					convo.next();

				} else {
					// need to ask user about it
					askUserForReminder(err, convo);

				}


				convo.on('end', (convo) => {

					const { UserId, SlackUserId, remindTimeStamp, customNote } = convo.reminderObject;
					if (remindTimeStamp) {
						models.Reminder.create({
							remindTime: remindTimeStamp,
							UserId,
							customNote
						});
					}

				});
			});

		});

	});

}

// user did not accurately ask for a reminder and we need to clarify
function askUserForReminder(response, convo) {

	const { tz } = convo.reminderObject;
	var now = moment();

	convo.ask("Sorry, still learning :dog:. Please let me know the time that you want a reminder `i.e. at 4:51pm`", (response, convo) => {

		var remindTimeStamp = witTimeResponseToTimeZoneObject(response, tz);

		if (remindTimeStamp) {
			convo.reminderObject.remindTimeStamp = remindTimeStamp;
			var remindTimeStampString = remindTimeStamp.format('h:mm a');
			convo.say( `Okay, :alarm_clock: set. See you at ${remindTimeStampString}!`);
		} else {
			convo.say("Ah I'm sorry. Still not getting you :thinking_face:");
			convo.repeat();
		}

		convo.next();
	});

}
