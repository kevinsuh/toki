'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startSessionStartConversation = startSessionStartConversation;
exports.finalizeTimeAndTasksToStart = finalizeTimeAndTasksToStart;

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
	askWhichTasksToWorkOn(convo);
	convo.next();
}

/**
 *    ENTRY POINTS INTO THE ACTUAL SESSION (FINALIZE CONFIRM)
 */

// confirm task and time in one place and start if it's good
function finalizeTimeAndTasksToStart(convo) {
	var _convo$sessionStart = convo.sessionStart;
	var SlackUserId = _convo$sessionStart.SlackUserId;
	var tz = _convo$sessionStart.tz;
	var dailyTask = _convo$sessionStart.dailyTask;
	var calculatedTimeObject = _convo$sessionStart.calculatedTimeObject;
	var calculatedTime = _convo$sessionStart.calculatedTime;

	// we need both time and task in order to start session

	if (!calculatedTimeObject) {
		confirmTimeForTasks(convo);
		return;
	} else if (!dailyTask) {
		askWhichTasksToWorkOn(convo);
		return;
	}

	// will only be a single task now
	var taskText = dailyTask.dataValues.Task.text;

	// will only be a single task now
	var minutes = dailyTask.dataValues.minutes;
	var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);

	convo.ask({
		text: 'Ready to work on `' + taskText + '` for ' + timeString + ' until *' + calculatedTime + '*?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "I was unable to process your decision",
			actions: [{
				name: _constants.buttonValues.startNow.name,
				text: "Yup :punch:",
				value: _constants.buttonValues.startNow.value,
				type: "button",
				style: "primary"
			}, {
				name: _constants.buttonValues.changeTask.name,
				text: "Change Task",
				value: _constants.buttonValues.changeTask.value,
				type: "button"
			}, {
				name: _constants.buttonValues.changeSessionTime.name,
				text: "Change Time",
				value: _constants.buttonValues.changeSessionTime.value,
				type: "button"
			}]
		}]
	}, [{ // NL equivalent to buttonValues.startNow.value
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			convo.sessionStart.confirmStart = true;
			convo.stop();
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsChangeTask,
		callback: function callback(response, convo) {
			askWhichTasksToWorkOn(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsChangeTime,
		callback: function callback(response, convo) {
			askForCustomTotalMinutes(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {

			convo.sessionStart.confirmStart = false;
			convo.say("Okay! Let me know when you're ready to `start a session` for one of your priorities :grin: ");
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
 *    CHOOSE TASK
 */

// ask which tasks the user wants to work on
function askWhichTasksToWorkOn(convo) {
	// this should only be said FIRST_TIME_USER
	// convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

	var _convo$sessionStart2 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart2.SlackUserId;
	var dailyTasks = _convo$sessionStart2.dailyTasks;

	if (!dailyTasks) {
		getUserDailyTasks(convo);
	} else {
		(function () {
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
		})();
	}
}

function getUserDailyTasks(convo) {
	var SlackUserId = convo.sessionStart.SlackUserId;


	_models2.default.User.find({
		where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
		include: [_models2.default.SlackUser]
	}).then(function (user) {
		user.getDailyTasks({
			where: ['"DailyTask"."type" = ?', "live"]
		}).then(function (dailyTasks) {
			convo.sessionStart.dailyTasks = dailyTasks;
			askWhichTasksToWorkOn(convo);
		});
	});
}

// if user decides to work on existing tasks
function confirmTasks(response, convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart3 = convo.sessionStart;
	var dailyTasks = _convo$sessionStart3.dailyTasks;
	var tasksToWorkOnHash = _convo$sessionStart3.tasksToWorkOnHash;

	var tasksToWorkOnString = response.text;

	// if we capture 0 valid tasks from string, then we start over
	var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(tasksToWorkOnString, dailyTasks);

	if (!taskNumbersToWorkOnArray) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("You can pick a task from your list `i.e. tasks 1, 3` or create a new task");
		askWhichTasksToWorkOn(convo);
		return;
	}

	// if not invalid, we can set the tasksToWorkOnArray
	taskNumbersToWorkOnArray.forEach(function (taskNumber) {
		var index = taskNumber - 1; // make this 0-index based
		if (dailyTasks[index]) tasksToWorkOnHash[taskNumber] = dailyTasks[index];
	});

	convo.sessionStart.tasksToWorkOnHash = tasksToWorkOnHash;
	confirmTimeForTasks(convo);
	convo.next();
}

// calculate ask about the time to the existing tasks user chose
function confirmTimeForTasks(convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart4 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart4.SlackUserId;
	var tz = _convo$sessionStart4.tz;
	var dailyTask = _convo$sessionStart4.dailyTask;

	// will only be a single task now

	var minutes = dailyTask.dataValues.minutes;

	if (minutes) {
		var now = (0, _momentTimezone2.default)().tz(tz);
		var calculatedTimeObject = now.add(minutes, 'minutes');
		var calculatedTimeString = calculatedTimeObject.format("h:mm a");

		convo.sessionStart.minutes = minutes;
		convo.sessionStart.calculatedTime = calculatedTimeString;
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

	finalizeTimeAndTasksToStart(convo);
}
//# sourceMappingURL=startWorkSessionFunctions.js.map