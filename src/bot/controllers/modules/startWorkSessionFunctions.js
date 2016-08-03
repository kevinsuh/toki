import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, deleteConvoAskMessage, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { dateStringToMomentTimeZone, witTimeResponseToTimeZoneObject, witDurationToMinutes, witDurationToTimeZoneObject} from '../../lib/miscHelpers';

import intentConfig from '../../lib/intents';
import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, startSessionOptionsAttachments } from '../../lib/constants';

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */


// user just started conversation and is choosing which tasks to work on
// this is the starting point to all other functions here!
export function startSessionStartConversation(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	convo.say("Let's do it :weight_lifter:");
	askWhichTaskToWorkOn(convo);
	convo.next();

}

/**
 *    ENTRY POINTS INTO THE ACTUAL SESSION (FINALIZE CONFIRM)
 */

// confirm task and time in one place and start if it's good
export function finalizeTimeAndTasksToStart(convo) {

	const { SlackUserId, tz, dailyTask, calculatedTimeObject, minutes }  = convo.sessionStart;
	let now = moment();

	// we need both time and task in order to start session
	if (!calculatedTimeObject || !minutes) {
		confirmTimeForTask(convo);
		return;
	} else if (!dailyTask) {
		askWhichTaskToWorkOn(convo);
		return;
	}

	// will only be a single task now
	let taskText = dailyTask.dataValues ? `\`${dailyTask.dataValues.Task.text}\`` : 'your task';

	// will only be a single task now
	let timeString     = convertMinutesToHoursString(minutes);
	let calculatedTime = calculatedTimeObject.format("h:mma");

	convo.ask({
		text: `Ready to work on ${taskText} for ${timeString} until *${calculatedTime}*?`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "START_SESSION",
				color: colorsHash.turquoise.hex,
				fallback: "I was unable to process your decision",
				actions: [
					{
							name: buttonValues.startNow.name,
							text: "Yes :punch:",
							value: buttonValues.startNow.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.changeTask.name,
							text: "Change Task",
							value: buttonValues.changeTask.value,
							type: "button"
					},
					{
							name: buttonValues.changeSessionTime.name,
							text: "Change Time",
							value: buttonValues.changeSessionTime.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{
			pattern: utterances.containsChangeTask,
			callback: function(response, convo) {
				convo.say("Okay, let's change tasks!");
				askWhichTaskToWorkOn(convo);
				convo.next();
			}
		},
		{
			pattern: utterances.containsChangeTime,
			callback: function(response, convo) {
				askForCustomTotalMinutes(convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startNow.value
			pattern: utterances.yes,
			callback: function(response, convo) {
				convo.sessionStart.confirmStart = true;
				convo.stop();
				convo.next();
			}
		},
		{
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {

				convo.sessionStart.confirmStart = false;
				convo.say("Okay! Let me know when you're ready to `start a session` for one of your priorities :grin: ");
				convo.next();

			}
		},
		{ // this is failure point. restart with question
			default: true,
			callback: function(response, convo) {
				convo.say("I didn't quite get that :thinking_face:");
				convo.repeat();
				convo.next();
			}
		}
	]);
}

/**
 *    CHOOSE TASK
 */

// ask which tasks the user wants to work on
function askWhichTaskToWorkOn(convo, question = '') {

	// this should only be said FIRST_TIME_USER
	// convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

	const { SlackUserId, dailyTasks, dailyTask }  = convo.sessionStart;
	if (!dailyTasks) {
		getUserDailyTasks(convo);
	} else {
		const { task: { bot } } = convo;
		let taskArray = dailyTasks.filter((currentDailyTask) => {
			if (currentDailyTask.dataValues.id != dailyTask.dataValues.id)
				return true;
		});
		let options = { dontUsePriority: true }
		let taskListMessage = convertArrayToTaskListMessage(taskArray, options);
		if (question == '') {
			question = `Which task would you like to work on instead?`
		}
		let message = `${question}\n${taskListMessage}`;
		convo.ask({
			text: message,
			attachments:[
				{
					attachment_type: 'default',
					callback_id: "START_SESSION",
					fallback: "I was unable to process your decision",
					color: colorsHash.grey.hex,
					actions: [
						{
								name: buttonValues.neverMind.name,
								text: "Never mind!",
								value: buttonValues.neverMind.value,
								type: "button",
						}
					]
				}
			]
		},[
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {
					let taskText = dailyTask.dataValues ? `\`${dailyTask.dataValues.Task.text}\`` : 'your task';
					convo.say(`Sure thing! Let's stay working on ${taskText}`);
					confirmTimeForTask(convo)
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {
					// user inputed task #'s, not new task button
					confirmTasks(response, convo, taskArray);
					convo.next();
				}
			}
		]);
	}
}

function getUserDailyTasks(convo) {

	const { SlackUserId }  = convo.sessionStart;

	models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [ models.SlackUser ]
		})
		.then((user) => {
			user.getDailyTasks({
				where: [`"DailyTask"."type" = ?`, "live"],
				include: [ models.Task ]
			})
			.then((dailyTasks) => {
				dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
				convo.sessionStart.dailyTasks = dailyTasks;
				askWhichTaskToWorkOn(convo);
			})
		})

}

// if user decides to work on existing tasks
function confirmTasks(response, convo, taskArray = []) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { dailyTasks }          = convo.sessionStart;

	if (taskArray.length == 0) {
		taskArray = dailyTasks;
	}

	let taskNumbersToWorkOnArray = convertTaskNumberStringToArray(response.text, taskArray);
	let taskIndexToWorkOn        = taskNumbersToWorkOnArray[0] - 1;

	if (taskIndexToWorkOn >= 0) {
		if (taskNumbersToWorkOnArray.length == 1) {
			// SUCCESS
			convo.sessionStart.dailyTask = taskArray[taskIndexToWorkOn];
			confirmTimeForTask(convo);
		} else {
			// only one at a time
			convo.say("Let's work on one priority at a time!");
			let question = "Which of your remaining priorities do you want to work on?";
			askWhichTaskToWorkOn(convo, question);
		}
		
	} else {
		convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
		let question = "Which of these do you want to work on?";
		askWhichTaskToWorkOn(convo, question);
	}

}

// calculate ask about the time to the existing tasks user chose
function confirmTimeForTask(convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { SlackUserId, tz, dailyTask }  = convo.sessionStart;

	// will only be a single task now
	let minutes = dailyTask.dataValues.minutes;

	if (minutes) {
		let now = moment().tz(tz);
		let calculatedTimeObject = now.add(minutes, 'minutes');

		convo.sessionStart.minutes              = minutes;
		convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

		finalizeTimeAndTasksToStart(convo);

	} else {
		// ask for how many minutes to work.
		askForCustomTotalMinutes(convo);

	}

	convo.next();

}

/**
 *      WANTS CUSTOM TIME TO TASKS
 */

// ask for custom amount of time to work on
function askForCustomTotalMinutes(convo) {

	const { task }                       = convo;
	const { bot, source_message }        = task;
	const { SlackUserId, tz, dailyTask } = convo.sessionStart;

	// will only be a single task now
	let taskText = dailyTask.dataValues ? `\`${dailyTask.dataValues.Task.text}\`` : 'your task';

	convo.ask(`How long do you want to work on ${taskText} for?`, (response, convo) => {

		var { intentObject: { entities } } = response;
		// for time to tasks, these wit intents are the only ones that makes sense
		if (entities.duration || entities.datetime) {
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
	const SlackUserId             = response.user;
	const { tz }                  = convo.sessionStart;
	var now                       = moment().tz(tz);

	// use Wit to understand the message in natural language!
	var { intentObject: { entities } } = response;

	var customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
	var customTimeString = customTimeObject.format("h:mm a");
	let minutes          = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

	convo.sessionStart.calculatedTimeObject = customTimeObject;
	convo.sessionStart.minutes              = minutes;

	finalizeTimeAndTasksToStart(convo);

}


/**
 * 		ACTUAL START SESSION ABSTRACTION
 */

export function startSessionWithConvoObject(sessionStart) {

	// all of these constants are necessary!
	const { bot, SlackUserId, dailyTask, calculatedTimeObject, UserId, minutes } = sessionStart;

	if (!bot || !SlackUserId || !UserId || !dailyTask || !calculatedTimeObject || !minutes) {
		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
			convo.say("Uh oh, something went wrong trying to `start your session` :dog: Let me know when you want to try again!");
		});
		return;
	}

	let startTime = moment();
	if (!dailyTask.dataValues.minutes) {
		// update dailyTask minutes here cause it hasn't existed up to this point
		let DailyTaskId = dailyTask.dataValues.id;
		models.DailyTask.update({
			minutes
		}, {
			where: [`"id" = ? `, DailyTaskId ]
		});
	}
	// endTime is from when you hit start
	let endTime   = moment().add(minutes, 'minutes');

	models.WorkSession.create({
		UserId,
		startTime,
		endTime
	})
	.then((workSession) => {

		let dailyTaskIds = [dailyTask.dataValues.id];
		workSession.setDailyTasks(dailyTaskIds);

		let taskString    = dailyTask.dataValues.Task.text;
		let minutesString = convertMinutesToHoursString(minutes);
		let timeString    = endTime.format("h:mma");

		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

			convo.say("Let's do it :boom:!");
			convo.say(`Good luck with \`${taskString}\`! See you in ${minutesString} at *${timeString}*`);
			convo.say({
				text: `Your focused work session starts now :weight_lifter:`,
				attachments: startSessionOptionsAttachments
			});

		});

	})
}
