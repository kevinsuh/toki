import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { utterances } from '../../lib/botResponses';
import { witTimeResponseToTimeZoneObject, witDurationToTimeZoneObject, dateStringToMomentTimeZone } from '../../lib/miscHelpers';
import { convertTimeStringToMinutes } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

import { resumeQueuedReachouts } from '../index';

// base controller for reminders
export default function(controller) {

	// get reminder
	// if user did not specify reminder, then go through conversational flow about it
	controller.hears(['custom_reminder'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {

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

				// these are array of objects
				const { text, intentObject: { entities: { reminder, datetime, duration } } } = message;
				const SlackUserId = message.user;

				// if command starts with "add", then we must assume they are adding a task
				if (utterances.startsWithAdd.test(text) && !utterances.containsCheckin.test(text)) {

					/**
					 * 		TRIGGERING ADD TASK FLOW (will now loop to edit_tasks_flow)
					 */
					var intent = intentConfig.ADD_TASK;
					
					var userMessage = {
						text,
						reminder,
						duration
					}

					// if the user says tasks (plural), then assume
					// they want to add multiple tasks
					var tasksRegExp = new RegExp(/(\btasks\b)/i);
					if (tasksRegExp.test(text)) {
						intent = intentConfig.EDIT_TASKS;
					}

					var config = {
						intent,
						SlackUserId,
						message: userMessage
					}

					controller.trigger(`new_session_group_decision`, [ bot, config ]);

					return;
				}

				var config = {
					text,
					reminder,
					datetime,
					duration,
					SlackUserId
				};

				// handle for snooze!
				var response = message.text;
				if (utterances.containsSnooze.test(response)) {

					if (utterances.onlyContainsSnooze.test(response)) {
						// automatically do default snooze here then
						controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId }]);
					} else {
						// ask how long to snooze for
						controller.trigger(`snooze_reminder_flow`, [ bot, config ]);
					}

					return;
				}

				config.message       = message;
				if (utterances.containsOnlyCheckin.test(text)) {
					config.reminder_type = "work_session";
				}

				controller.trigger(`ask_for_reminder`, [ bot, config ]);

			});

		}, 850);

	});

	// asking for snooze flow
	// snooze currently does not handle `datetime`, ONLY `duration`
	controller.on(`snooze_reminder_flow`, (bot, config) => {

		const { SlackUserId, duration } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// get timezone of user
			const { SlackUser: { tz } } = user;

			if (duration) {
				var remindTimeStampObject = witDurationToTimeZoneObject(duration, tz)
				controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId, remindTimeStampObject }]);
			} else {
				// need to ask for duration if it doesn't exist
				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					convo.snoozeConfig = {
						SlackUserId,
						tz
					};

					convo.ask("How long would you like to extend your session?", (response, convo) => {

						var time    = response.text;
						var minutes = false;

						var validMinutesTester = new RegExp(/[\dh]/);
						if (validMinutesTester.test(time)) {
							minutes = convertTimeStringToMinutes(time);
						}

						if (minutes) {
							convo.snoozeConfig.minutes = minutes;
						} else {
							convo.say("Sorry, still learning :dog:. Let me know how long you want to extend your session `i.e. 10 min`");
							convo.repeat();
						}
						convo.next();

					});
					convo.on('end', (convo) => {
						const { tz, minutes } = convo.snoozeConfig;

						// create moment object out of info
						if (minutes) {
							var now                   = moment().tz(tz);
							var remindTimeStampObject = now.add(minutes, 'minutes');

							controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId, remindTimeStampObject }]);

						} else {
							resumeQueuedReachouts(bot, { SlackUserId });
						}

					})
				});

			}

		});

	})

	// this is conversational flow to get reminder set
	// option to pass in message and skip asking process
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
