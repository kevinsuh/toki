import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { randomInt } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone } from '../../lib/miscHelpers';

// START OF A WORK SESSION
export default function(controller) {

	/**
	 * 		STARTING A WORK SESSION
	 * 		
	 * 		start work session
	 * 		show tasks
	 * 		tell what time you will end at
	 * 		
	 */
	controller.hears(['start_session'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		// find user then get tasks
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		}).then((user) => {

			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(() => {

				bot.startConversation(message, (err, convo) => {

					var name = user.nickName || user.email;

					// configure necessary properties on convo object
					convo.name = name;

					// object that contains values important to this conversation
					convo.sessionStart = {
						UserId: user.id,
						SlackUserId
					};

					// temporary fix to get tasks
					var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");

					// FIND DAILY TASKS, THEN START THE CONVERSATION
					models.DailyTask.findAll({
						where: [`"DailyTask"."createdAt" > ? AND "Task"."UserId" = ?`, timeAgoForTasks, user.id],
						order: `"priority" ASC`,
						include: [ models.Task ]
					}).then((dailyTasks) => {

							console.log("your tasks for the day!");
							console.log(dailyTasks);

							// user needs to enter daily tasks
							if (dailyTasks.length == 0) {
								convo.sessionStart.noDailyTasks = true;
								convo.stop();
							}

							// save the daily tasks for reference
							dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
							convo.sessionStart.dailyTasks = dailyTasks;

							// entry point of thy conversation
							startSessionStartConversation(err, convo);
					});

					// on finish convo
					convo.on('end', (convo) => {

						var responses        = convo.extractResponses();
						var { sessionStart } = convo;

						// proxy that we have not gone through right flow
						if (!sessionStart.calculatedTimeObject) {
							bot.reply(message, "Sorry but something went wrong :dog:. Let's start the session again");
							return;
						}

						if (convo.status == 'completed') {

							console.log("finished and this is the data:");
							console.log(sessionStart);

							/**
							 * 		1. tell user time and tasks to work on
							 * 		
							 *		2. save responses to DB:
							 *			session:
							 *				- tasks to work on (tasksToWorkOnArray)
							 *				- sessionEndTime (calculated)
							 *				- reminder (time + possible customNote)
							 *
							 * 		3. start session
							 */

							var { UserId, SlackUserId, dailyTasks, calculatedTime, calculatedTimeObject, tasksToWorkOnArray, checkinTimeObject, reminderNote } = sessionStart;

							var taskObjectsToWorkOnArray = [];
							dailyTasks.forEach((dailyTask) => {
								if (tasksToWorkOnArray.indexOf(dailyTask.dataValues.priority) > -1)
									taskObjectsToWorkOnArray.push(dailyTask);
							});

							// user wants a reminder
							if (checkinTimeObject) {
								var checkInTimeStamp = checkinTimeObject.format("YYYY-MM-DD HH:mm:ss");
								models.Reminder.create({
									remindTime: checkInTimeStamp,
									UserId,
									customNote: reminderNote
								});
							}

							// save session and which tasks are assigned to it
							console.log("taskObjectsToWorkOnArray:");
							console.log(taskObjectsToWorkOnArray);

							var taskListMessage = convertArrayToTaskListMessage(taskObjectsToWorkOnArray);

							// success! end convo with user and save items to DB
							bot.reply(message, `Excellent! See you at ${calculatedTime}! :timer_clock:`);
							bot.reply(message, `Good luck with: \n${taskListMessage}`);

						} else {

							// ending convo prematurely
							console.log("ending convo early: \n\n\n\n");

							console.log("controller:");
							console.log(controller);
							console.log("\n\n\n\n\nbot:");
							console.log(bot);

							// no tasks saved for the day
							if (sessionStart.noDailyTasks) {

								const { task }                = convo;
								const { bot, source_message } = task;

								bot.reply(message, "Hey! You haven't entered any tasks yet today. Let's `start the day` before doing a session");

								// should go to start a day... NOT CONFIGURED YET.
								// var config = {
								// 	message: source_message
								// }
								// error: `cannot set property 'channel' of undefined`
								// controller.trigger('start_day', [bot, config]);

								// console.log("controller:");
								// console.log(controller);
								// console.log("\n\n\n\n\nbot:");
								// console.log(bot);

								
							} else {
								// default premature end
								bot.reply(message, "Okay! Exiting now. Let me know when you want to start on a session");
							}

						}
					});

				});

			}, randomInt(1000,1750));

		});


	});

};

// user just started conversation and is choosing which tasks to work on
function startSessionStartConversation(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { UserId, dailyTasks }  = convo.sessionStart;

	convo.say(`Which tasks would you like to work on?`);

	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	convo.say(taskListMessage);
	convo.say("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`");
	convo.say("I'll follow up with you when your task should be completed, based on your estimate :wink:");

	askWhichTasksToWorkOn(response, convo);
	convo.next();


}

// confirm user for the tasks and 
function askWhichTasksToWorkOn(response, convo) {
	convo.ask("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:", (response, convo) => {
		confirmTasks(response, convo);
		convo.next();
	}, { 'key' : 'tasksToWorkOn' });
}

function confirmTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { dailyTasks }          = convo.sessionStart;
	var { tasksToWorkOn }         = convo.responses;
	var tasksToWorkOnArray        = tasksToWorkOn.text.split(",");

	var isInvalid = false;
	var invalidTaskNumber = false;
	var numberRegEx = new RegExp(/[\d]+/);
	tasksToWorkOnArray = tasksToWorkOnArray.map((task) => {
		var taskNumber = task.match(numberRegEx);
		if (taskNumber) { // no number found in that split index!
			taskNumber = parseInt(taskNumber[0]);
			if (taskNumber > dailyTasks.length) {
				invalidTaskNumber = true;
			}
			return taskNumber;
		} else {
			isInvalid = true;
			return taskNumber;
		}
	});

	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	// repeat convo if invalid w/ informative context
	if (isInvalid) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`");
		convo.say(taskListMessage);
		askWhichTasksToWorkOn(response, convo);
		return;
	} else if (invalidTaskNumber) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		convo.say(taskListMessage);
		askWhichTasksToWorkOn(response, convo);
		return;
	}

	convo.ask(`To :heavy_check_mark:, you want to work on tasks: ${tasksToWorkOnArray.join(", ")}?`,[
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.sessionStart.tasksToWorkOnArray = tasksToWorkOnArray;
				confirmTimeForTasks(response,convo);
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say("Let's give this another try then :repeat_one:");
				convo.say(taskListMessage);
				askWhichTasksToWorkOn(response, convo);
				convo.next();
			}
		}
	]);

}

// calculate ask about the time to the given tasks
function confirmTimeForTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { tasksToWorkOnArray, dailyTasks }  = convo.sessionStart;
	const SlackUserId = response.user;

	console.log("convo sessino start:");
	console.log(convo.sessionStart);

	var totalMinutes = 0;
	dailyTasks.forEach((dailyTask) => {
		if (tasksToWorkOnArray.indexOf(dailyTask.dataValues.priority) > -1) {
			console.log("tasksToWorkOnArray:");
			console.log(tasksToWorkOnArray);
			console.log("this specific daily task:");
			console.log(dailyTask);
			var { dataValues: { minutes } } = dailyTask;
			totalMinutes += parseInt(minutes);
		}
	});

	// get timezone of user before continuing
	// we aren't putting this in helper function b/c of this convo's custom CB
	bot.startTyping(source_message.channel);
	bot.api.users.list({
  	presence: 1
  }, (err, response) => {
  	const { members } = response; // members are all users registered to your bot

  	for (var i = 0; i < members.length; i++) {
  		if (members[i].id == SlackUserId) {
  			var timeZoneObject = {};
  			timeZoneObject.tz = members[i].tz;
  			timeZoneObject.tz_label = members[i].tz_label;
  			timeZoneObject.tz_offset = members[i].tz_offset;
  			convo.sessionStart.timeZone = timeZoneObject;
  			break;
  		}
  	}

  	var { timeZone } = convo.sessionStart;
  	if (timeZone && timeZone.tz) {
  		timeZone = timeZone.tz;
  	} else {
  		timeZone = "America/New_York"; // THIS IS WRONG AND MUST BE FIXED
  		// SOLUTION IS MOST LIKELY TO ASK USER HERE WHAT THEIR TIMEZONE IS.
  	}
  	console.log(`Your timezone is: ${timeZone}`);
  	var calculatedTimeObject = moment().tz(timeZone).add(totalMinutes, 'minutes')
  	var calculatedTimeString = calculatedTimeObject.format("h:mm a");
  	convo.say(`Nice! That should take until ${calculatedTimeString} based on your estimate`);
  	convo.ask(`Would you like to work until ${calculatedTimeString}?`, [
			{
				pattern: bot.utterances.yes,
				callback: (response, convo) => {

					// success! now save session time info for the user
					convo.sessionStart.totalMinutes         = totalMinutes;
					convo.sessionStart.calculatedTime       = calculatedTimeString;
					convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

					askForCheckIn(response, convo);
					convo.next();
				}
			},
			{
				pattern: bot.utterances.no,
				callback: (response, convo) => {
					askForCustomTotalMinutes(response, convo);
					convo.next();
				}
			}
		]);

  });

}

// ask for custom amount of time to work on
function askForCustomTotalMinutes(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	convo.ask("What time would you like to work until? You can also tell me the duration you'd like to work, like `55 minutes` :upside_down_face:", (response, convo) => {

		var { intentObject: { entities } } = response;
		// for time to tasks, these wit intents are the only ones that makes sense
		if (entities.duration || entities.custom_time) {
			confirmCustomTotalMinutes(response, convo);
		} else {
			// invalid
			convo.say("I'm sorry, I didn't catch that :dog:");
			convo.repeat();
		}

		convo.next();

	});

};

function confirmCustomTotalMinutes(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	var { timeZone: { tz } } = convo.sessionStart;

	// use Wit to understand the message in natural language!
	var { intentObject: { entities } } = response;
	var customTimeObject; // moment object of time
	var customTimeString; // format to display (`h:mm a`)
	var customTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)
	if (entities.duration) {

		var durationArray = entities.duration;
		var durationSeconds = 0;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);

		// add minutes to now
		customTimeObject = moment().tz(tz).add(durationSeconds, 'seconds');
		customTimeString = customTimeObject.format("h:mm a");

	} else if (entities.custom_time) {
		// get rid of timezone to make it tz-neutral
		// then create a moment-timezone object with specified timezone
		var timeStamp = entities.custom_time[0].value;

		// create time object based on user input + timezone
		customTimeObject = createMomentObjectWithSpecificTimeZone(timeStamp, tz);
		customTimeString = customTimeObject.format("h:mm a");

	}

	convo.ask(`So you'd like to work until ${customTimeString}?`, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {

				var now             = moment();
				var minutesDuration = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

				// success! now save session time info for the user
				convo.sessionStart.totalMinutes         = minutesDuration;
				convo.sessionStart.calculatedTime       = customTimeString;
				convo.sessionStart.calculatedTimeObject = customTimeObject;

				askForCheckIn(response, convo);
				convo.next();

			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.ask("Yikes, my bad. Let's try this again. Just tell me how many minutes (`ex. 45 min`) or until what time (`ex. 3:15pm`) you'd like to work right now", (response, convo) => {
					confirmCustomTotalMinutes(response, convo);
					convo.next();
				});
				convo.next();
			}
		}
	]);

}

// ask if user wants a checkin during middle of session
function askForCheckIn(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { tasksToWorkOnArray, dailyTasks }  = convo.sessionStart;
	const SlackUserId = response.user;

	convo.ask("Boom :boom: Would you like me to check in with you during this session to make sure you're on track?", [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.say("Sure thing! Let me know what time you want me to check in with you");
				convo.ask("I can also check in a certain number of minutes or hours from now, like `40 minutes` or `1 hour`", (response, convo) => {

					var { intentObject: { entities } } = response;
					// for time to tasks, these wit intents are the only ones that makes sense
					if (entities.duration || entities.custom_time) {
						confirmCheckInTime(response, convo);
					} else {
						// invalid
						convo.say("I'm sorry, I didn't catch that :dog:");
						convo.say("Please put either a time like `2:41pm`, or a number of minutes or hours like `35 minutes`");
						convo.silentRepeat();
					}

					convo.next();

				}, { 'key' : 'respondTime' });
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say("Last thing - is there anything you'd like me to remind you during the check in?");
				convo.next();
			}
		}
	]);

}

// confirm check in time with user
function confirmCheckInTime(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	var { timeZone: { tz } } = convo.sessionStart;

	// use Wit to understand the message in natural language!
	var { intentObject: { entities } } = response;
	var checkinTimeObject; // moment object of time
	var checkinTimeString; // format to display (`h:mm a`)
	var checkinTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)
	if (entities.duration) {

		var durationArray = entities.duration;
		var durationSeconds = 0;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);

		// add minutes to now
		checkinTimeObject = moment().tz(tz).add(durationSeconds, 'seconds');
		checkinTimeString = checkinTimeObject.format("h:mm a");

	} else if (entities.custom_time) {
		// get rid of timezone to make it tz-neutral
		// then create a moment-timezone object with specified timezone
		var timeStamp = entities.custom_time[0].value;

		// create time object based on user input + timezone
		checkinTimeObject = createMomentObjectWithSpecificTimeZone(timeStamp, tz);
		checkinTimeString = checkinTimeObject.format("h:mm a");

	}

	convo.ask(`I'll be checking in with you at ${checkinTimeString}. Is that correct?`, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {

				var now             = moment();
				var minutesDuration = Math.round(moment.duration(checkinTimeObject.diff(now)).asMinutes());

				// success! now save checkin time info for the user
				convo.sessionStart.checkinTimeObject = checkinTimeObject;
				convo.sessionStart.checkinTimeString = checkinTimeString;
				
				askForReminderDuringCheckin(response, convo);
				convo.next();

			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say(`Let's rewind :vhs: :rewind:`);
				convo.ask("What time would you like me to check in with you? Just tell me a time or a certain number of minutes from the start of your session you'd like me to check in", (response, convo) => {
					confirmCheckInTime(response, convo);
					convo.next();
				});
				convo.next();
			}
		}
	]);


}

function askForReminderDuringCheckin(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	convo.say("Last thing - is there anything you'd like me to remind you during the check in?");
	convo.ask("This could be a note like `call Mary` or `should be on the second section of the proposal by now`", [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.ask(`What note would you like me to remind you about?`, (response, convo) => {
					getReminderNoteFromUser(response, convo);
					convo.next();
				});

				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				finishSessionForUser(response, convo);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				// we are assuming anything else is the reminderNote
				getReminderNoteFromUser(response, convo);
				convo.next();
			}
		}
	], { 'key' : 'reminderNote' });

}

function getReminderNoteFromUser(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	const note = response.text;

	const { sessionStart: { checkinTimeObject, checkinTimeString } } = convo;

	convo.ask(`Does this look good: \`${note}\`?`, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {

				convo.sessionStart.reminderNote = note;
				convo.next();

			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.ask(`Just tell me a one-line note and I'll remind you about it at ${checkinTimeString}!`, (response, convo) => {
					getReminderNoteFromUser(response, convo);
					convo.next();
				})
				convo.next();
			}
		}
	]);

}
