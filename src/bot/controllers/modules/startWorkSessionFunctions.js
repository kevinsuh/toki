import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, deleteConvoAskMessage, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { dateStringToMomentTimeZone, witTimeResponseToTimeZoneObject, witDurationToMinutes, witDurationToTimeZoneObject} from '../../lib/miscHelpers';

import intentConfig from '../../lib/intents';
import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash } from '../../lib/constants';

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */


// user just started conversation and is choosing which tasks to work on
// this is the starting point to all other functions here!
export function startSessionStartConversation(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	convo.say("Let's do it :weight_lifter:");
	askWhichTasksToWorkOn(convo);
	convo.next();

}

/**
 *    ENTRY POINTS INTO THE ACTUAL SESSION (FINALIZE CONFIRM)
 */

// confirm task and time in one place and start if it's good
export function finalizeTimeAndTasksToStart(convo) {

	const { SlackUserId, tz, dailyTask, calculatedTimeObject, calculatedTime }  = convo.sessionStart;

	// we need both time and task in order to start session
	if (!calculatedTimeObject) {
		confirmTimeForTasks(convo);
		return;
	} else if (!dailyTask) {
		askWhichTasksToWorkOn(convo);
		return;
	}

	// will only be a single task now
	let taskText = dailyTask.dataValues.Task.text;

		// will only be a single task now
	let minutes = dailyTask.dataValues.minutes;
	let timeString = convertMinutesToHoursString(minutes);

	convo.ask({
		text: `Ready to work on \`${taskText}\` for ${timeString} until *${calculatedTime}*?`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "START_SESSION",
				color: colorsHash.turquoise.hex,
				fallback: "I was unable to process your decision",
				actions: [
					{
							name: buttonValues.startNow.name,
							text: "Yup :punch:",
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
		{ // NL equivalent to buttonValues.startNow.value
			pattern: utterances.yes,
			callback: function(response, convo) {
				
				convo.sessionStart.confirmStart = true;
				convo.stop();
				convo.next();
			}
		},
		{
			pattern: utterances.containsChangeTask,
			callback: function(response, convo) {
				askWhichTasksToWorkOn(convo);
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
function askWhichTasksToWorkOn(convo) {
	// this should only be said FIRST_TIME_USER
	// convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

	const { SlackUserId, dailyTasks }  = convo.sessionStart;
	if (!dailyTasks) {
		getUserDailyTasks(convo);
	} else {
		const { task: { bot } } = convo;
		let taskListMessage = convertArrayToTaskListMessage(dailyTasks);
		let message = `Which task(s) would you like to work on?\n${taskListMessage}`;
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
						name: buttonValues.newTask.name,
						text: "New Task",
						value: buttonValues.newTask.value,
						type: "button"
						}
					]
				}
			]
		},[
			{
				pattern: buttonValues.newTask.value,
				callback: (response, convo) => {
					addNewTask(response, convo);
					convo.next();
				}
			},
			{
				pattern: utterances.containsNew,
				callback: (response, convo) => {

					// delete button when answered with NL
					deleteConvoAskMessage(response.channel, bot);
					convo.say("Okay! Let's work on a new task");

					// NL contains "new" (i.e. "i'll do a new task")
					addNewTask(response, convo);
					convo.next();
				}
			},
			{
				pattern: utterances.noAndNeverMind,
				callback: (response, convo) => {

					// delete button when answered with NL
					deleteConvoAskMessage(response.channel, bot);

					convo.say("Okay! Let me know when you're ready to `start a session` :grin: ");
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {
					// user inputed task #'s, not new task button
					confirmTasks(response, convo);
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
			include: [
				models.SlackUser
			]
		})
		.then((user) => {
			user.getDailyTasks({
				where: [`"DailyTask"."type" = ?`, "live"]
			})
			.then((dailyTasks) => {
				convo.sessionStart.dailyTasks = dailyTasks;
				askWhichTasksToWorkOn(convo);
			})
		})

}

// if user decides to work on existing tasks
function confirmTasks(response, convo) {

	const { task }                          = convo;
	const { bot, source_message }           = task;
	const { dailyTasks, tasksToWorkOnHash } = convo.sessionStart;
	var tasksToWorkOnString                 = response.text;

	// if we capture 0 valid tasks from string, then we start over
	var taskNumbersToWorkOnArray = convertTaskNumberStringToArray(tasksToWorkOnString, dailyTasks);

	if (!taskNumbersToWorkOnArray) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("You can pick a task from your list `i.e. tasks 1, 3` or create a new task");
		askWhichTasksToWorkOn(convo);
		return;
	}

	// if not invalid, we can set the tasksToWorkOnArray
	taskNumbersToWorkOnArray.forEach((taskNumber) => {
		var index = taskNumber - 1; // make this 0-index based
		if (dailyTasks[index])
			tasksToWorkOnHash[taskNumber] = dailyTasks[index];
	});

	convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
	confirmTimeForTasks(convo);
	convo.next();

}

// calculate ask about the time to the existing tasks user chose
function confirmTimeForTasks(convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { SlackUserId, tz, dailyTask }  = convo.sessionStart;

	// will only be a single task now
	let minutes = dailyTask.dataValues.minutes;

	if (minutes) {
		let now = moment().tz(tz);
		let calculatedTimeObject = now.add(minutes, 'minutes');
		let calculatedTimeString = calculatedTimeObject.format("h:mm a");

		convo.sessionStart.minutes              = minutes;
		convo.sessionStart.calculatedTime       = calculatedTimeString;
		convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

		finalizeTimeAndTasksToStart(convo);

	} else {
		// ask for how many minutes to work
		askForCustomTotalMinutes(convo);

	}

	convo.next();

}

/**
 *      WANTS CUSTOM TIME TO TASKS
 */

// ask for custom amount of time to work on
function askForCustomTotalMinutes(convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId             = response.user;

	convo.ask("How long, or until what time, would you like to work?", (response, convo) => {

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

	convo.sessionStart.calculatedTime       = customTimeString;
	convo.sessionStart.calculatedTimeObject = customTimeObject;

	finalizeTimeAndTasksToStart(convo);

}

