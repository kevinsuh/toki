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

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {

			// these are array of objects
			const { text, intentObject: { entities: { reminder, datetime, duration } } } = message;
			const SlackUserId = message.user;

			// if command starts with "add", then we must assume they are adding a task
			if (utterances.startsWithAdd.test(text)) {
				/**
				 * 		TRIGGERING ADD TASK FLOW (add_task_flow)
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

			// if they want a reminder, just tell them how to structure it
			if (!datetime && !duration) {
				console.log("about to ask for reminder...");
				console.log(config);
				controller.trigger(`ask_for_reminder`, [ bot, config ]);
				return;
			} else {
				// user has already specified time
				controller.trigger(`set_reminder`, [ bot, config ]);
			}

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

					convo.ask("How long would you like to snooze?", (response, convo) => {

						var time    = response.text;
						var minutes = false;

						var validMinutesTester = new RegExp(/[\dh]/);
						if (validMinutesTester.test(time)) {
							minutes = convertTimeStringToMinutes(time);
						}

						if (minutes) {
							convo.snoozeConfig.minutes = minutes;
						} else {
							convo.say("Sorry, still learning :dog:. Let me know how long you want to snooze for `i.e. 10 min`");
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

					var { text, intentObject: { entities } } = response;
					const { reminder, duration, datetime } = entities;

					if (!duration && !datetime) {
						convo.say("Sorry, still learning :dog:. Please let me know the time that you want a reminder `i.e. at 4:51pm`");
						convo.repeat();
					} else {

						convo.reminderConfig.text        = text;
						convo.reminderConfig.duration    = duration;
						convo.reminderConfig.datetime = datetime;

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

		const { SlackUserId, reminder, datetime, duration, text } = config;

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
					text,
					intentObject: {
						entities: {
							duration,
							datetime
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
					resumeQueuedReachouts(bot, { SlackUserId });

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
