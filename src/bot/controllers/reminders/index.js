import os from 'os';
import { wit } from '../index';
import moment from 'moment';

import models from '../../../app/models';
import { utterances } from '../../lib/botResponses';

// base controller for reminders
export default function(controller) {

	// get reminder
	// if user did not specify reminder, then go through conversational flow about it
	controller.hears(['custom_reminder'], 'direct_message', wit.hears, (bot, message) => {

		// these are array of objects
		const { reminder, reminder_duration, custom_time, duration } = message.intentObject.entities;
		const SlackUserId = message.user;

		var config = {
			reminder,
			reminder_duration,
			custom_time,
			duration,
			SlackUserId
		};

		// if reminder without a specific time, set to `wants_reminder`
		if (!reminder_duration && !custom_time && !duration) {
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

		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

			convo.reminderConfig = {
				SlackUserId
			};

			convo.say("When would you like me to check in with you? :bellhop_bell: ");
			convo.say("I can check in at a specific time, like `2:35pm`");
			convo.ask("I can also check in a certain number of minutes or hours from now, like `40 minutes` or `1 hour`", (response, convo) => {

				// need some way to have a global quit functionality
				if (response.text == "quit" | response.text == "cancel") {
					return;
				}

				var { intentObject: { entities } } = response;
				const { reminder, reminder_duration, duration, custom_time } = entities;

				console.log("huhh");
				console.log("response:");
				console.log(response);

				console.log("\n\n\n");
				console.log(JSON.stringify(response));

				// if user enters duration
				if (reminder_duration) {
					convo.reminderConfig.reminder_duration = reminder_duration;
				} else if (duration){
					convo.reminderConfig.reminder_duration = duration;
				}

				// if user enters a time
				convo.reminderConfig.reminder_time = custom_time;

				convo.say("Excellent! Would you like me to remind you about anything when I check in?");
				convo.ask("You can leave any kind of one-line note, like `call Kevin` or `follow up with Taylor about design feedback`", [
					{
						pattern: utterances.yes,
						callback: (response, convo) => {
							convo.ask(`What note would you like me to remind you about?`, (response, convo) => {
								console.log("RESPONSE TEXTT");
								console.log(response);
								console.log("\n\n\n\n\n");
								convo.reminderConfig.reminder_text = [{value:response.text}];
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
							console.log("RESPONSE TEXTT");
								console.log(response);
								console.log("\n\n\n\n\n");
							convo.reminderConfig.reminder_text = [{value:response.text}];
							convo.next();
						}
					}
				]);
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

	// the actual setting of reminder
	controller.on(`set_reminder`, (bot, config) => {

		const { SlackUserId, reminder, reminder_duration, custom_time, duration } = config;

		var now = moment();

		// get custom note
		var customNote = null;
		if (reminder_text) {
			customNote = reminder_text[0].value;
		} else if (reminder) {
			customNote = reminder[0].value;
		}

		var remindTimeStamp; // for the message (`h:mm a`)
		var remindTimeStampForDB; // for DB (`YYYY-MM-DD HH:mm:ss`)
		if (reminder_duration || duration) { // i.e. ten more minutes
			console.log("inside of reminder_duration\n\n\n\n");
			var reminderDuration = reminder_duration ? reminder_duration : duration;
			var durationSeconds = 0;
			for (var i = 0; i < reminderDuration.length; i++) {
				durationSeconds += reminderDuration[i].normalized.value;
			}
			var durationMinutes = Math.floor(durationSeconds / 60);

			remindTimeStamp = now.add(durationSeconds, 'seconds');
			
		} else if (custom_time) { // i.e. `at 3pm`
			console.log("inside of reminder_time\n\n\n\n");
			remindTimeStamp = custom_time[0].value;
			remindTimeStamp = moment(remindTimeStamp); // in PST because of Wit default settings

			remindTimeStamp.add(remindTimeStamp._tzm - now.utcOffset(), 'minutes'); // convert from PST to local TZ
		}

		if (remindTimeStamp) {
			// insert into DB and send message
			remindTimeStampForDB = remindTimeStamp.format('YYYY-MM-DD HH:mm:ss');
			remindTimeStamp      = remindTimeStamp.format('h:mm a');

			// find user then reply
			models.SlackUser.find({
				where: { SlackUserId }
			})
			.then((slackUser) => {
				models.Reminder.create({
					remindTime: remindTimeStampForDB,
					UserId: slackUser.UserId,
					customNote
				})
				.then((reminder) => {
					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
						convo.say( `Okay, :alarm_clock: set. See you at ${remindTimeStamp}!`);
						convo.next();
					});
				});
			});
		} else {


			/**
			 * 			TERRIBLE CODE BELOW
			 * 				THIS MEANS A BUG HAPPENED
			 * 	~~	HOPEFULLY THIS NEVER COMES UP EVER ~~
			 */

			// this means bug happened
			// hopefully this never comes up
			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
				convo.ask("Sorry, still learning :dog:. Please let me know the time that you want a reminder `i.e. 4:51pm`", (response, convo) => {

					var { intentObject: { entities } } = response;
					const { reminder, reminder_duration, duration, custom_time } = entities;

					var remindTime = custom_time;

					remindTimeStamp = remindTime[0].value;
					remindTimeStamp = moment(remindTimeStamp); // in PST because of Wit default settings

					remindTimeStamp.add(remindTimeStamp._tzm - now.utcOffset(), 'minutes'); // convert from PST to local TZ
					// insert into DB and send message
					remindTimeStampForDB = remindTimeStamp.format('YYYY-MM-DD HH:mm:ss');
					remindTimeStamp      = remindTimeStamp.format('h:mm a');

					// find user then reply
					models.SlackUser.find({
						where: { SlackUserId }
					})
					.then((slackUser) => {
						models.Reminder.create({
							remindTime: remindTimeStampForDB,
							UserId: slackUser.UserId,
							customNote
						})
						.then((reminder) => {
							bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
								convo.say( `Okay, :alarm_clock: set. See you at ${remindTimeStamp}!`);
								convo.next();
							});
						});
					});

				});
			});

		}

		

	});


}
