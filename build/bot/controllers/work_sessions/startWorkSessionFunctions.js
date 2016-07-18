'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startSessionStartConversation = startSessionStartConversation;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */

// user just started conversation and is choosing which tasks to work on
// this is the starting point to all other functions here!
function startSessionStartConversation(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;


	convo.say("Let's do it :weight_lifter:");
	askWhichTasksToWorkOn(response, convo);
	convo.next();
}

/**
 *    ENTRY POINTS INTO THE ACTUAL SESSION (FINALIZE CONFIRM)
 */

// confirm task and time in one place and start if it's good
function finalizeTimeAndTasksToStart(response, convo) {
	var _convo$sessionStart = convo.sessionStart;
	var totalMinutes = _convo$sessionStart.totalMinutes;
	var calculatedTimeObject = _convo$sessionStart.calculatedTimeObject;
	var calculatedTime = _convo$sessionStart.calculatedTime;
	var tasksToWorkOnHash = _convo$sessionStart.tasksToWorkOnHash;
	var dailyTasks = _convo$sessionStart.dailyTasks;
	var bot = convo.task.bot;

	// convert hash to array

	var tasksToWorkOnArray = [];
	for (var key in tasksToWorkOnHash) {
		tasksToWorkOnArray.push(tasksToWorkOnHash[key]);
	}
	var taskTextsToWorkOnArray = tasksToWorkOnArray.map(function (task) {
		var text = task.dataValues ? task.dataValues.text : task.text;
		return text;
	});
	var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

	convo.ask({
		text: 'Ready to work on ' + tasksToWorkOnString + ' until *' + calculatedTime + '*?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "I was unable to process your decision",
			actions: [{
				name: _constants.buttonValues.startNow.name,
				text: "Start :punch:",
				value: _constants.buttonValues.startNow.value,
				type: "button",
				style: "primary"
			}, {
				name: _constants.buttonValues.checkIn.name,
				text: "Add Checkin",
				value: _constants.buttonValues.checkIn.value,
				type: "button"
			}, {
				name: _constants.buttonValues.changeTask.name,
				text: "Change Task",
				value: _constants.buttonValues.changeTask.value,
				type: "button",
				style: "danger"
			}, {
				name: _constants.buttonValues.changeSessionTime.name,
				text: "Change Time",
				value: _constants.buttonValues.changeSessionTime.value,
				type: "button",
				style: "danger"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.startNow.value,
		callback: function callback(response, convo) {
			convo.sessionStart.confirmStart = true;
			convo.stop();
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startNow.value
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.sessionStart.confirmStart = true;
			convo.stop();
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.checkIn.value,
		callback: function callback(response, convo) {
			askForCheckIn(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.checkIn.value
		pattern: _botResponses.utterances.containsCheckin,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			askForCheckIn(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.changeTask.value,
		callback: function callback(response, convo) {
			askWhichTasksToWorkOn(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.changeTask.value
		pattern: _botResponses.utterances.containsChangeTask,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			askWhichTasksToWorkOn(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.changeSessionTime.value,
		callback: function callback(response, convo) {
			askForCustomTotalMinutes(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.changeSessionTime.value
		pattern: _botResponses.utterances.containsChangeTime,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			askForCustomTotalMinutes(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay! Let me know when you're ready to `start a session` :grin: ");
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

// start session with a new task
function finalizeNewTaskToStart(response, convo) {

	// here we add this task to dailyTasks
	var _convo$sessionStart2 = convo.sessionStart;
	var totalMinutes = _convo$sessionStart2.totalMinutes;
	var calculatedTimeObject = _convo$sessionStart2.calculatedTimeObject;
	var calculatedTime = _convo$sessionStart2.calculatedTime;
	var tasksToWorkOnHash = _convo$sessionStart2.tasksToWorkOnHash;
	var dailyTasks = _convo$sessionStart2.dailyTasks;
	var newTask = _convo$sessionStart2.newTask;
	var bot = convo.task.bot;


	convo.ask({
		text: 'Ready to work on `' + newTask.text + '` until *' + calculatedTime + '*?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "I was unable to process your decision",
			actions: [{
				name: _constants.buttonValues.startNow.name,
				text: "Start :punch:",
				value: _constants.buttonValues.startNow.value,
				type: "button",
				style: "primary"
			}, {
				name: _constants.buttonValues.checkIn.name,
				text: "Add Checkin",
				value: _constants.buttonValues.checkIn.value,
				type: "button"
			}, {
				name: _constants.buttonValues.changeTask.name,
				text: "Change Task",
				value: _constants.buttonValues.changeTask.value,
				type: "button",
				style: "danger"
			}, {
				name: _constants.buttonValues.changeSessionTime.name,
				text: "Change Time",
				value: _constants.buttonValues.changeSessionTime.value,
				type: "button",
				style: "danger"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.startNow.value,
		callback: function callback(response, convo) {

			tasksToWorkOnHash[1] = newTask;
			convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
			convo.sessionStart.confirmStart = true;

			convo.stop();
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startNow.value
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			tasksToWorkOnHash[1] = newTask;
			convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
			convo.sessionStart.confirmStart = true;

			convo.stop();
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.checkIn.value,
		callback: function callback(response, convo) {

			tasksToWorkOnHash[1] = newTask;
			convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
			convo.sessionStart.confirmStart = true;

			askForCheckIn(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.checkIn.value
		pattern: _botResponses.utterances.containsCheckin,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			tasksToWorkOnHash[1] = newTask;
			convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
			convo.sessionStart.confirmStart = true;

			askForCheckIn(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.changeTask.value,
		callback: function callback(response, convo) {
			convo.addNewTaskCustomMessage = 'What is it? `i.e. clean up market report` ';
			convo.sessionStart.newTask.text = false;
			addNewTask(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.changeTask.value
		pattern: _botResponses.utterances.containsChangeTask,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.addNewTaskCustomMessage = 'What is it? `i.e. clean up market report` ';
			convo.sessionStart.newTask.text = false;
			addNewTask(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.changeSessionTime.value,
		callback: function callback(response, convo) {

			tasksToWorkOnHash[1] = newTask;
			convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
			convo.sessionStart.confirmStart = true;

			convo.sessionStart.newTask.minutes = false;

			addTimeToNewTask(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.changeSessionTime.value
		pattern: _botResponses.utterances.containsChangeTime,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			tasksToWorkOnHash[1] = newTask;
			convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
			convo.sessionStart.confirmStart = true;

			convo.sessionStart.newTask.minutes = false;

			addTimeToNewTask(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay! Let me know when you're ready to `start a session` :grin: ");
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

// this is if you want a checkin after approving of task + times
// option add note or start session after setting a checkin
function finalizeCheckinTimeToStart(response, convo) {

	console.log("\n\n ~~ in finalizeCheckinTimeToStart ~~ \n\n");

	var _convo$sessionStart3 = convo.sessionStart;
	var checkinTimeString = _convo$sessionStart3.checkinTimeString;
	var checkinTimeObject = _convo$sessionStart3.checkinTimeObject;
	var reminderNote = _convo$sessionStart3.reminderNote;
	var tasksToWorkOnHash = _convo$sessionStart3.tasksToWorkOnHash;
	var calculatedTime = _convo$sessionStart3.calculatedTime;
	var bot = convo.task.bot;


	var confirmCheckinMessage = '';
	if (checkinTimeString) {
		confirmCheckinMessage = 'Excellent, I\'ll check in with you at *' + checkinTimeString + '*!';
		if (reminderNote) {
			confirmCheckinMessage = 'Excellent, I\'ll check in with you at *' + checkinTimeString + '* about `' + reminderNote + '`!';
		}
	}

	// convert hash to array
	var tasksToWorkOnArray = [];
	for (var key in tasksToWorkOnHash) {
		tasksToWorkOnArray.push(tasksToWorkOnHash[key]);
	}
	var taskTextsToWorkOnArray = tasksToWorkOnArray.map(function (task) {
		var text = task.dataValues ? task.dataValues.text : task.text;
		return text;
	});
	var tasksToWorkOnString = (0, _messageHelpers.commaSeparateOutTaskArray)(taskTextsToWorkOnArray);

	convo.say(confirmCheckinMessage);
	convo.ask({
		text: 'Ready to work on ' + tasksToWorkOnString + ' until *' + calculatedTime + '*?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "I was unable to process your decision",
			actions: [{
				name: _constants.buttonValues.startNow.name,
				text: "Start :punch:",
				value: _constants.buttonValues.startNow.value,
				type: "button",
				style: "primary"
			}, {
				name: _constants.buttonValues.changeCheckinTime.name,
				text: "Change time",
				value: _constants.buttonValues.changeCheckinTime.value,
				type: "button"
			}, {
				name: _constants.buttonValues.addCheckinNote.name,
				text: "Add note",
				value: _constants.buttonValues.addCheckinNote.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.startNow.value,
		callback: function callback(response, convo) {
			convo.sessionStart.confirmStart = true;
			convo.stop();
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startNow.value
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.sessionStart.confirmStart = true;
			convo.stop();
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.changeCheckinTime.value,
		callback: function callback(response, convo) {
			askForCheckIn(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.changeCheckinTime.value
		pattern: _botResponses.utterances.containsChangeTime,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			askForCheckIn(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.addCheckinNote.value,
		callback: function callback(response, convo) {
			askForReminderDuringCheckin(response, convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.addCheckinNote.value
		pattern: _botResponses.utterances.containsAddNote,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			askForReminderDuringCheckin(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay! Let me know when you're ready to `start a session` :grin: ");
			convo.next();
		}
	}, { // this is failure point. restart with question
		default: true,
		callback: function callback(response, convo) {
			convo.say("I didn't quite get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

/**
 *    EXISTING TASKS CHOSEN
 */

// ask which tasks the user wants to work on
function askWhichTasksToWorkOn(response, convo) {
	// this should only be said FIRST_TIME_USER
	// convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

	var _convo$sessionStart4 = convo.sessionStart;
	var UserId = _convo$sessionStart4.UserId;
	var dailyTasks = _convo$sessionStart4.dailyTasks;
	var bot = convo.task.bot;

	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
	var message = 'Which task(s) would you like to work on?\n' + taskListMessage;
	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			fallback: "I was unable to process your decision",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.newTask.name,
				text: "New Task",
				value: _constants.buttonValues.newTask.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.newTask.value,
		callback: function callback(response, convo) {
			addNewTask(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsNew,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);
			convo.say("Okay! Let's work on a new task");

			// NL contains "new" (i.e. "i'll do a new task")
			addNewTask(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay! Let me know when you're ready to `start a session` :grin: ");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			// user inputed task #'s, not new task button
			confirmTasks(response, convo);
			convo.next();
		}
	}]);
}

// if user decides to work on existing tasks
function confirmTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart5 = convo.sessionStart;
	var dailyTasks = _convo$sessionStart5.dailyTasks;
	var tasksToWorkOnHash = _convo$sessionStart5.tasksToWorkOnHash;

	var tasksToWorkOnString = response.text;

	// if we capture 0 valid tasks from string, then we start over
	var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksToWorkOnString, dailyTasks);

	if (!taskNumbersToWorkOnArray) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("You can pick a task from your list `i.e. tasks 1, 3` or create a new task");
		askWhichTasksToWorkOn(response, convo);
		return;
	}

	// if not invalid, we can set the tasksToWorkOnArray
	taskNumbersToWorkOnArray.forEach(function (taskNumber) {
		var index = taskNumber - 1; // make this 0-index based
		if (dailyTasks[index]) tasksToWorkOnHash[taskNumber] = dailyTasks[index];
	});

	convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
	confirmTimeForTasks(response, convo);
	convo.next();
}

// calculate ask about the time to the existing tasks user chose
function confirmTimeForTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart6 = convo.sessionStart;
	var tasksToWorkOnHash = _convo$sessionStart6.tasksToWorkOnHash;
	var dailyTasks = _convo$sessionStart6.dailyTasks;
	var tz = _convo$sessionStart6.tz;

	var SlackUserId = response.user;

	var totalMinutes = 0;
	for (var key in tasksToWorkOnHash) {
		var _task = tasksToWorkOnHash[key];
		var minutes = _task.dataValues.minutes;

		totalMinutes += parseInt(minutes);
	}

	var now = (0, _momentTimezone2.default)().tz(tz);
	var calculatedTimeObject = now.add(totalMinutes, 'minutes');
	var calculatedTimeString = calculatedTimeObject.format("h:mm a");

	// these are the final values used to determine work session info
	convo.sessionStart.totalMinutes = totalMinutes;
	convo.sessionStart.calculatedTime = calculatedTimeString;
	convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

	finalizeTimeAndTasksToStart(response, convo);
}

/**
 *      NEW TASK CHOSEN
 */

// if user wants to add a new task instead
function addNewTask(response, convo) {

	var message = 'What is it? `i.e. clean up market report for 45 minutes` ';
	if (convo.addNewTaskCustomMessage) {
		message = convo.addNewTaskCustomMessage;
	}

	convo.ask(message, function (response, convo) {
		var task = convo.task;
		var bot = task.bot;
		var source_message = task.source_message;

		var SlackUserId = response.user;
		var tz = convo.sessionStart.tz;
		var entities = response.intentObject.entities;

		// create new task

		convo.sessionStart.newTask.text = response.text;

		if (entities.duration && entities.reminder) {
			convo.sessionStart.newTask.minutes = (0, _miscHelpers.witDurationToMinutes)(entities.duration);
			convo.sessionStart.newTask.text = entities.reminder[0].value;

			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
			if (customTimeObject) {
				var customTimeString = customTimeObject.format("h:mm a");
				convo.sessionStart.calculatedTime = customTimeString;
				convo.sessionStart.calculatedTimeObject = customTimeObject;
			}
		}

		addTimeToNewTask(response, convo);
		convo.next();
	});
}

// get the time desired for new task
function addTimeToNewTask(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var tz = convo.sessionStart.tz;


	if (convo.sessionStart.newTask.minutes) {
		finalizeNewTaskToStart(response, convo);
	} else {
		convo.ask('How long would you like to work on `' + convo.sessionStart.newTask.text + '`?', function (response, convo) {

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

				var minutes = (0, _messageHelpers.convertTimeStringToMinutes)(timeToTask);
				var customTimeObject = (0, _momentTimezone2.default)().tz(tz).add(minutes, 'minutes');
				var customTimeString = customTimeObject.format("h:mm a");

				convo.sessionStart.newTask.minutes = minutes;
				convo.sessionStart.calculatedTime = customTimeString;
				convo.sessionStart.calculatedTimeObject = customTimeObject;

				finalizeNewTaskToStart(response, convo);
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
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;

	convo.ask("How long, or until what time, would you like to work?", function (response, convo) {
		var entities = response.intentObject.entities;
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
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;
	var tz = convo.sessionStart.tz;

	var now = (0, _momentTimezone2.default)().tz(tz);

	// use Wit to understand the message in natural language!
	var entities = response.intentObject.entities;


	var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
	var customTimeString = customTimeObject.format("h:mm a");

	convo.sessionStart.calculatedTime = customTimeString;
	convo.sessionStart.calculatedTimeObject = customTimeObject;

	finalizeTimeAndTasksToStart(response, convo);
}

/**
 *      WANTS CHECKIN TO TASKS
 */

// ask if user wants a checkin during middle of session
function askForCheckIn(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;

	convo.ask("When would you like me to check in with you?", function (response, convo) {
		var entities = response.intentObject.entities;
		// for time to tasks, these wit intents are the only ones that makes sense

		if (entities.duration || entities.datetime) {
			// || entities.reminder
			confirmCheckInTime(response, convo);
		} else {
			// invalid
			convo.say("I'm sorry, I'm still learning :dog:");
			convo.say("For this one, put only the time first (i.e. `2:41pm` or `35 minutes`) and then let's figure out your note)");
			convo.repeat();
		}

		convo.next();
	}, { 'key': 'respondTime' });
}

// confirm check in time with user
function confirmCheckInTime(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;
	var now = (0, _momentTimezone2.default)();
	var tz = convo.sessionStart.tz;


	console.log("\n\n ~~ message in confirmCheckInTime ~~ \n\n");

	// use Wit to understand the message in natural language!
	var entities = response.intentObject.entities;

	// just assuming this will work?

	var checkinTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
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
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;

	var SlackUserId = response.user;

	convo.say("Is there anything you'd like me to remind you during the check in?");
	convo.ask("This could be a note like `call Eileen` or `should be on the second section of the proposal by now`", [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.ask('What note would you like me to remind you about?', function (response, convo) {
				convo.sessionStart.reminderNote = response.text;
				finalizeCheckinTimeToStart(response, convo);
				convo.next();
			});

			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			finalizeCheckinTimeToStart(response, convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			// we are assuming anything else is the reminderNote
			convo.sessionStart.reminderNote = response.text;
			finalizeCheckinTimeToStart(response, convo);
			convo.next();
		}
	}], { 'key': 'reminderNote' });
}
//# sourceMappingURL=startWorkSessionFunctions.js.map