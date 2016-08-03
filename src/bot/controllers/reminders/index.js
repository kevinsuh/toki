import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { utterances } from '../../lib/botResponses';
import { witTimeResponseToTimeZoneObject, witDurationToTimeZoneObject, dateStringToMomentTimeZone } from '../../lib/miscHelpers';
import { convertTimeStringToMinutes } from '../../lib/messageHelpers';

import { resumeQueuedReachouts } from '../index';

// base controller for reminders
export default function(controller) {

	// right now, you can only get a reminder through trigger!
	controller.on(`ask_for_reminder`, (bot, config) => {

		const { SlackUserId, message, reminder_type } = config;

		let reminderOrCheckInString = reminder_type == "work_session" ? 'check in at' : 'set a reminder for';
		let reminderOrCheckInExample = reminder_type == "work_session" ? '`i.e. halfway done by 4pm`' : '`i.e. pick up laundry at 8pm`';

		console.log(`\n\n config:`);
		console.log(config);

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// get timezone of user
			const { SlackUser: { tz } } = user;
			const UserId                = user.id;

			let shouldAskForReminder = true;

			if (message) {

				const { intentObject: { entities: { reminder, duration, datetime } } } = message;
				let customNote = reminder ? reminder[0].value : null;
				let customTimeObject = witTimeResponseToTimeZoneObject(message, tz);
				let responseMessage = '';

				// shortcut add and do not ask about the checkin
				if (customTimeObject) {

					shouldAskForReminder = false;
					let customTimeString = customTimeObject.format('h:mm a');

					bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

						responseMessage = `Okay, I'll ${reminderOrCheckInString} ${customTimeString}`;
						if (customNote) {
							responseMessage = `${responseMessage} about \`${customNote}\``;
						}

						responseMessage = `${responseMessage}! :muscle:`;
						convo.say(responseMessage);
						convo.next();

						convo.on('end', (convo) => {

							// quick adding a reminder requires both text + time!
							models.Reminder.create({
								remindTime: customTimeObject,
								UserId,
								customNote,
								type: reminder_type
							})
							.then((reminder) => {
								resumeQueuedReachouts(bot, { SlackUserId });
							});
						});

					});
				}
			} 

			if (shouldAskForReminder) {

				bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

					convo.checkIn = {
						SlackUserId
					}

					convo.ask(`What time would you like me to ${reminderOrCheckInString}? Leave a note in the same line if you want me to remember it for you ${reminderOrCheckInExample}`, (response, convo) => {

						const { intentObject: { entities: { reminder, duration, datetime } } } = response;

						let customNote = reminder ? reminder[0].value : null;
						let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
						let responseMessage = '';

						if (customTimeObject) {

							convo.checkIn.customTimeObject = customTimeObject;
							convo.checkIn.customNote       = customNote;

							let customTimeString = customTimeObject.format('h:mm a');

							responseMessage = `Okay, I'll ${reminderOrCheckInString} ${customTimeString}`;
							if (customNote) {
								responseMessage = `${responseMessage} about \`${customNote}\``;
							}

							responseMessage = `${responseMessage}! :muscle:`;
							convo.say(responseMessage);

						} else {

							if (customNote) {
								responseMessage = `Sorry, I need a time :thinking_face: (either \`${customNote} in 30 minutes\` or \`${customNote} at 4:30pm\`)`
							} else {
								responseMessage = `Sorry, I need a time :thinking_face: (either \`in 30 minutes\` or \`at 4:30pm\`)`;
							}
							convo.say(responseMessage);
							convo.repeat();
						}

						convo.next();

					});

					convo.next();

					convo.on('end', (convo) => {

						const { customTimeObject, customNote } = convo.checkIn;

						// quick adding a reminder requires both text + time!
						models.Reminder.create({
							remindTime: customTimeObject,
							UserId,
							customNote,
							type: reminder_type
						})
						.then((reminder) => {
							resumeQueuedReachouts(bot, { SlackUserId });
						});

					});
				});

			}
				
		});

	});

}
