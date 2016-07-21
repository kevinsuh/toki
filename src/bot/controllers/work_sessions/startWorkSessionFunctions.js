import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, deleteConvoAskMessage } from '../../lib/messageHelpers';
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
	askWhichTasksToWorkOn(response, convo);
	convo.next();

}

/**
 *    ENTRY POINTS INTO THE ACTUAL SESSION (FINALIZE CONFIRM)
 */

// confirm task and time in one place and start if it's good
function finalizeTimeAndTasksToStart(response, convo) {

	const { sessionStart: { totalMinutes, calculatedTimeObject, calculatedTime, tasksToWorkOnHash, dailyTasks }, task: { bot } } = convo;

	// convert hash to array
	var tasksToWorkOnArray = [];
	for (var key in tasksToWorkOnHash) {
		tasksToWorkOnArray.push(tasksToWorkOnHash[key]);
	}
	var taskTextsToWorkOnArray = tasksToWorkOnArray.map((task) => {
		var text = task.dataValues ? task.dataValues.text : task.text;
		return text;
	});
	var tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

	convo.ask({
		text: `Ready to work on ${tasksToWorkOnString} until *${calculatedTime}*?`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "START_SESSION",
				color: colorsHash.turquoise.hex,
				fallback: "I was unable to process your decision",
				actions: [
					{
							name: buttonValues.startNow.name,
							text: "Start :punch:",
							value: buttonValues.startNow.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.checkIn.name,
							text: "Add Checkin",
							value: buttonValues.checkIn.value,
							type: "button"
					},
					{
							name: buttonValues.changeTask.name,
							text: "Change Task",
							value: buttonValues.changeTask.value,
							type: "button",
							style: "danger"
					},
					{
							name: buttonValues.changeSessionTime.name,
							text: "Change Time",
							value: buttonValues.changeSessionTime.value,
							type: "button",
							style: "danger"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.startNow.value,
			callback: function(response, convo) {
				convo.sessionStart.confirmStart = true;
				convo.stop();
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startNow.value
			pattern: utterances.yes,
			callback: function(response, convo) {
				
				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.sessionStart.confirmStart = true;
				convo.stop();
				convo.next();
			}
		},
		{
			pattern: buttonValues.checkIn.value,
			callback: function(response, convo) {
				askForCheckIn(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.checkIn.value
			pattern: utterances.containsCheckin,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				askForCheckIn(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeTask.value,
			callback: function(response, convo) {
				askWhichTasksToWorkOn(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.changeTask.value
			pattern: utterances.containsChangeTask,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				askWhichTasksToWorkOn(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeSessionTime.value,
			callback: function(response, convo) {
				askForCustomTotalMinutes(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.changeSessionTime.value
			pattern: utterances.containsChangeTime,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				askForCustomTotalMinutes(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);
				convo.sessionStart.confirmStart = false;

				convo.say("Okay! Let me know when you're ready to `start a session` :grin: ");
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

// start session with a new task
function finalizeNewTaskToStart(response, convo) {

	// here we add this task to dailyTasks
	var { sessionStart: { totalMinutes, calculatedTimeObject, calculatedTime, tasksToWorkOnHash, dailyTasks, newTask }, task: { bot } } = convo;

	convo.ask({
		text: `Ready to work on \`${newTask.text}\` until *${calculatedTime}*?`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "START_SESSION",
				color: colorsHash.turquoise.hex,
				fallback: "I was unable to process your decision",
				actions: [
					{
							name: buttonValues.startNow.name,
							text: "Start :punch:",
							value: buttonValues.startNow.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.checkIn.name,
							text: "Add Checkin",
							value: buttonValues.checkIn.value,
							type: "button"
					},
					{
							name: buttonValues.changeTask.name,
							text: "Change Task",
							value: buttonValues.changeTask.value,
							type: "button",
							style: "danger"
					},
					{
							name: buttonValues.changeSessionTime.name,
							text: "Change Time",
							value: buttonValues.changeSessionTime.value,
							type: "button",
							style: "danger"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.startNow.value,
			callback: function(response, convo) {

				tasksToWorkOnHash[1]                 = newTask;
				convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
				convo.sessionStart.confirmStart      = true;

				convo.stop();
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startNow.value
			pattern: utterances.yes,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				tasksToWorkOnHash[1]                 = newTask;
				convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
				convo.sessionStart.confirmStart      = true;

				convo.stop();
				convo.next();

			}
		},
		{
			pattern: buttonValues.checkIn.value,
			callback: function(response, convo) {

				tasksToWorkOnHash[1]                 = newTask;
				convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
				convo.sessionStart.confirmStart      = true;

				askForCheckIn(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.checkIn.value
			pattern: utterances.containsCheckin,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				tasksToWorkOnHash[1]                 = newTask;
				convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
				convo.sessionStart.confirmStart      = true;

				askForCheckIn(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeTask.value,
			callback: function(response, convo) {
				convo.addNewTaskCustomMessage = `What is it? \`i.e. clean up market report\` `;
				convo.sessionStart.newTask.text = false;
				addNewTask(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.changeTask.value
			pattern: utterances.containsChangeTask,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.addNewTaskCustomMessage = `What is it? \`i.e. clean up market report\` `;
				convo.sessionStart.newTask.text = false;
				addNewTask(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeSessionTime.value,
			callback: function(response, convo) {

				tasksToWorkOnHash[1]                 = newTask;
				convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
				convo.sessionStart.confirmStart      = true;

				convo.sessionStart.newTask.minutes = false;

				addTimeToNewTask(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.changeSessionTime.value
			pattern: utterances.containsChangeTime,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				tasksToWorkOnHash[1]                 = newTask;
				convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
				convo.sessionStart.confirmStart      = true;

				convo.sessionStart.newTask.minutes = false;

				addTimeToNewTask(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);
				convo.sessionStart.confirmStart = false;

				convo.say("Okay! Let me know when you're ready to `start a session` :grin: ");
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

// this is if you want a checkin after approving of task + times
// option add note or start session after setting a checkin
function finalizeCheckinTimeToStart(response, convo) {

	console.log("\n\n ~~ in finalizeCheckinTimeToStart ~~ \n\n");

	const { sessionStart: { checkinTimeString, checkinTimeObject, reminderNote, tasksToWorkOnHash, calculatedTime }, task: { bot } } = convo;

	var confirmCheckinMessage = '';
	if (checkinTimeString) {
		confirmCheckinMessage = `Excellent, I'll check in with you at *${checkinTimeString}*!`;
		if (reminderNote) {
			confirmCheckinMessage = `Excellent, I'll check in with you at *${checkinTimeString}* about \`${reminderNote}\`!`;
		}
	}

	// convert hash to array
	var tasksToWorkOnArray = [];
	for (var key in tasksToWorkOnHash) {
		tasksToWorkOnArray.push(tasksToWorkOnHash[key]);
	}
	var taskTextsToWorkOnArray = tasksToWorkOnArray.map((task) => {
		var text = task.dataValues ? task.dataValues.text : task.text;
		return text;
	});
	var tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

	convo.say(confirmCheckinMessage);
	convo.ask({
		text: `Ready to work on ${tasksToWorkOnString} until *${calculatedTime}*?`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "START_SESSION",
				color: colorsHash.turquoise.hex,
				fallback: "I was unable to process your decision",
				actions: [
					{
							name: buttonValues.startNow.name,
							text: "Start :punch:",
							value: buttonValues.startNow.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.changeCheckinTime.name,
							text: "Change time",
							value: buttonValues.changeCheckinTime.value,
							type: "button"
					},
					{
							name: buttonValues.addCheckinNote.name,
							text: "Add note",
							value: buttonValues.addCheckinNote.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.startNow.value,
			callback: function(response, convo) {
				convo.sessionStart.confirmStart = true;
				convo.stop();
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startNow.value
			pattern: utterances.yes,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.sessionStart.confirmStart = true;
				convo.stop();
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeCheckinTime.value,
			callback: function(response, convo) {
				askForCheckIn(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.changeCheckinTime.value
			pattern: utterances.containsChangeTime,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				askForCheckIn(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.addCheckinNote.value,
			callback: function(response, convo) {
				askForReminderDuringCheckin(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.addCheckinNote.value
			pattern: utterances.containsAddNote,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				askForReminderDuringCheckin(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);
				convo.sessionStart.confirmStart = false;

				convo.say("Okay! Let me know when you're ready to `start a session` :grin: ");
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
 *    EXISTING TASKS CHOSEN
 */


// ask which tasks the user wants to work on
function askWhichTasksToWorkOn(response, convo) {
	// this should only be said FIRST_TIME_USER
	// convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

	const { UserId, dailyTasks }  = convo.sessionStart;
	const { task: { bot } } = convo;
	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);
	var message = `Which task(s) would you like to work on?\n${taskListMessage}`;
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
		askWhichTasksToWorkOn(response, convo);
		return;
	}

	// if not invalid, we can set the tasksToWorkOnArray
	taskNumbersToWorkOnArray.forEach((taskNumber) => {
		var index = taskNumber - 1; // make this 0-index based
		if (dailyTasks[index])
			tasksToWorkOnHash[taskNumber] = dailyTasks[index];
	});

	convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
	confirmTimeForTasks(response,convo);
	convo.next();

}

// calculate ask about the time to the existing tasks user chose
export function confirmTimeForTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { tasksToWorkOnHash, dailyTasks, tz }  = convo.sessionStart;

	var totalMinutes = 0;
	for (var key in tasksToWorkOnHash) {
		const task = tasksToWorkOnHash[key];
		var { dataValues: { minutes } } = task;
		totalMinutes += parseInt(minutes);
	}

	var now = moment().tz(tz);
	var calculatedTimeObject = now.add(totalMinutes, 'minutes');
	var calculatedTimeString = calculatedTimeObject.format("h:mm a");

	// these are the final values used to determine work session info
	convo.sessionStart.totalMinutes         = totalMinutes;
	convo.sessionStart.calculatedTime       = calculatedTimeString;
	convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

	finalizeTimeAndTasksToStart(response, convo);

}

/**
 *      NEW TASK CHOSEN
 */

// if user wants to add a new task instead
function addNewTask(response, convo) {

	var now = moment();

	var message = `What is it? \`i.e. clean up market report for 45 minutes\` `;
	if (convo.addNewTaskCustomMessage) {
		message = convo.addNewTaskCustomMessage;
	}

	convo.ask(message, (response, convo) => {

		const { task }                = convo;
		const { bot, source_message } = task;
		const SlackUserId             = response.user;
		const { tz }                  = convo.sessionStart;
		
		// let's try and use wit first, if no wit then use our reg ex tester
		var { text, intentObject: { entities: { reminder, datetime, duration } } } = response;

		var customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
		var customTimeString;
		var minutes;

		console.log("\n\n\nnot working in add new task?\n\n\n");
		console.log(customTimeObject);

		// create new task
		convo.sessionStart.newTask.text = response.text;

		if (customTimeObject && reminder) {

			// ~~ wit picked up datetime in the sentence! ~~

			convo.sessionStart.newTask.text = reminder[0].value;
			if (duration) {
				minutes = witDurationToMinutes(duration);
			} else {
				minutes = moment.duration(customTimeObject.diff(now)).asMinutes();
			}

			customTimeString = customTimeObject.format("h:mm a");

			convo.sessionStart.newTask.minutes      = minutes;
			convo.sessionStart.calculatedTime       = customTimeString;
			convo.sessionStart.calculatedTimeObject = customTimeObject;

		}

		addTimeToNewTask(response, convo);
		convo.next();

	});

}

// get the time desired for new task
function addTimeToNewTask(response, convo) {
	const { task }                        = convo;
	const { bot, source_message }         = task;
	var { sessionStart: { tz } } = convo;

	var now = moment();

	if (convo.sessionStart.newTask.minutes) {
		finalizeNewTaskToStart(response, convo);
	} else {
		convo.ask(`How long would you like to work on \`${convo.sessionStart.newTask.text}\`?`, (response, convo) => {

			// let's try and use wit first, if no wit then use our reg ex tester
			var { text, intentObject: { entities: { datetime, duration } } } = response;

			var customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
			var customTimeString;
			var minutes;
			if (customTimeObject) {
				
				if (duration) {
					minutes = witDurationToMinutes(duration);
				} else {
					minutes = moment.duration(customTimeObject.diff(now)).asMinutes();
				}

				customTimeString = customTimeObject.format("h:mm a");

				convo.sessionStart.newTask.minutes      = minutes;
				convo.sessionStart.calculatedTime       = customTimeString;
				convo.sessionStart.calculatedTimeObject = customTimeObject;

				finalizeNewTaskToStart(response, convo);

			} else {

				// regex flow as back up
				// ~~ HOPEFULLY WIT PICKS UP EVERYTHING THO ~~
				
				var timeToTask = response.text;

				var validMinutesTester = new RegExp(/[\dh]/);
				var isInvalid = false;
				if (!validMinutesTester.test(timeToTask)) {
					isInvalid = true;
				}

				// INVALID tester
				if (isInvalid) {
					convo.say("Oops, looks like you didn't put in valid minutes :thinking_face:. Let's try this again");
					convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `1 hour 15 min`");
					convo.repeat();
				} else {

					minutes          = convertTimeStringToMinutes(timeToTask);
					customTimeObject = moment().tz(tz).add(minutes, 'minutes');
					customTimeString = customTimeObject.format("h:mm a");

					convo.sessionStart.newTask.minutes      = minutes;
					convo.sessionStart.calculatedTime       = customTimeString;
					convo.sessionStart.calculatedTimeObject = customTimeObject;

					finalizeNewTaskToStart(response, convo);

				}

			} 
			convo.next();
		});
	}
}

/**
 *      WANTS CUSTOM TIME TO TASKS
 */

// ask for custom amount of time to work on
function askForCustomTotalMinutes(response, convo) {

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

	finalizeTimeAndTasksToStart(response, convo);

}


/**
 *      WANTS CHECKIN TO TASKS
 */

// ask if user wants a checkin during middle of session
function askForCheckIn(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	convo.ask("When would you like me to check in with you?", (response, convo) => {

		var { intentObject: { entities } } = response;
		// for time to tasks, these wit intents are the only ones that makes sense
		if (entities.duration || entities.datetime) { // || entities.reminder
			confirmCheckInTime(response, convo);
		} else {
			// invalid
			convo.say("I'm sorry, I'm still learning :dog:");
			convo.say("For this one, put only the time first (i.e. `2:41pm` or `35 minutes`) and then let's figure out your note)");
			convo.repeat();
		}

		convo.next();

	}, { 'key' : 'respondTime' });

}

// confirm check in time with user
function confirmCheckInTime(response, convo) {

	const { task }                 = convo;
	const { bot, source_message }  = task;
	const SlackUserId              = response.user;
	var now                        = moment();
	const { sessionStart: { tz } } = convo;

	console.log("\n\n ~~ message in confirmCheckInTime ~~ \n\n");

	// use Wit to understand the message in natural language!
	var { intentObject: { entities } } = response;

	// just assuming this will work?
	var checkinTimeObject = witTimeResponseToTimeZoneObject(response, tz);
	var checkinTimeString = checkinTimeObject.format("h:mm a");

	convo.sessionStart.checkinTimeObject = checkinTimeObject;
	convo.sessionStart.checkinTimeString = checkinTimeString;

	// skip the step if reminder exists
	if (entities.reminder) {
		convo.sessionStart.reminderNote = entities.reminder[0].value;
		finalizeCheckinTimeToStart(response, convo);
	} else {
		askForReminderDuringCheckin(response, convo);
	}

}

// wants a reminder note to the checkin
function askForReminderDuringCheckin(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	convo.say("Is there anything you'd like me to remind you during the check in?");
	convo.ask("This could be a note like `call Eileen` or `should be on the second section of the proposal by now`", [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.ask(`What note would you like me to remind you about?`, (response, convo) => {
					convo.sessionStart.reminderNote = response.text;
					finalizeCheckinTimeToStart(response, convo)
					convo.next();
				});

				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				finalizeCheckinTimeToStart(response, convo)
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				// we are assuming anything else is the reminderNote
				convo.sessionStart.reminderNote = response.text;
				finalizeCheckinTimeToStart(response, convo)
				convo.next();
			}
		}
	], { 'key' : 'reminderNote' });

}



