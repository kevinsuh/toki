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

					// start the flow
					startSessionStartConversation(err, convo);

					// on finish convo
					convo.on('end', (convo) => {
						var responses = convo.extractResponses();
						console.log(`done!`);
						console.log(responses);
						console.log(`here is sessionStart object:`);
						console.log(convo.sessionStart);

						if (convo.status == 'completed') {
							// begin thy user's session!
							bot.reply(message, "Okay let's start the session...?");

						} else {
							// if convo ends prematurely
							bot.reply(message, "Okay! Exiting now. Let me know when you want to start on a session");
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
	const { UserId }              = convo.sessionStart;

	console.log(`in asking which tasks to work on: ${convo.name}`);
	console.log(`here is session start obj: ${JSON.stringify(convo.sessionStart)}`);

	convo.say(`Which tasks would you like to work on?`);

	console.log("RESPONSE: ");
	console.log(response);
	console.log("\n\n\n\n");
	console.log("CONVO: ");
	console.log(convo);
	console.log("\n\n\n\n\n");

	bot.send({
		type: "typing",
		channel: source_message.channel
	});
	
	// temporary fix to get tasks
	var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");
	models.DailyTask.findAll({
		where: [`"DailyTask"."createdAt" > ? AND "Task"."UserId" = ?`, timeAgoForTasks, UserId],
		order: `"priority" ASC`,
		include: [ models.Task ]
	}).then((dailyTasks) => {

			dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
			var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

			convo.sessionStart.dailyTasks = dailyTasks;
			convo.say(taskListMessage);
			convo.say("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`");
			convo.say("I'll follow up with you when your task should be completed, based on your estimate :wink:");

			askWhichTasksToWorkOn(response, convo);
			convo.next();
	})

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
  	var calculatedTime = moment().tz(timeZone).add(totalMinutes, 'minutes').format("h:mm a");
  	convo.say(`Nice! That should take until ${calculatedTime} based on your estimate`);
  	convo.ask(`Would you like to work until ${calculatedTime}?`, [
			{
				pattern: bot.utterances.yes,
				callback: (response, convo) => {
					convo.sessionStart.totalMinutes   = totalMinutes;
					convo.sessionStart.calculatedTime = calculatedTime;
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


					// use helper method to get if either minute or hour
					// create helper method that sees if there is exactly one colon and if so, then will run that specific time in user's timezone
					// need to figure out how to handle users and their timezones
					// perhaps have "quit" option then a "configure time zone" option. then we can put it in the DB
					// OOOH have it in the onboarding flow! we can see if user has tz already or not
					convo.next();
				}, { 'key' : 'respondTime' });
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





