'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.finalizeTimeAndTasksToStart = finalizeTimeAndTasksToStart;
exports.startSessionWithConvoObject = startSessionWithConvoObject;

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
	var minutes = _convo$sessionStart.minutes;
	var currentSession = _convo$sessionStart.currentSession;

	var now = (0, _momentTimezone2.default)();

	// we need both time and task in order to start session
	if (!dailyTask) {
		askWhichTaskToWorkOn(convo);
		return;
	} else if (!calculatedTimeObject || !minutes) {
		confirmTimeForTask(convo);
		return;
	}

	// will only be a single task now
	var taskText = dailyTask.dataValues ? '`' + dailyTask.dataValues.Task.text + '`' : 'your task';

	// will only be a single task now
	var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
	var calculatedTime = calculatedTimeObject.format("h:mma");

	var question = 'Ready to work on ' + taskText + ' for ' + timeString + ' until *' + calculatedTime + '*?';
	if (currentSession) {
		question = 'You\'re currently working on `' + currentSession.sessionTasks + '` and have ' + currentSession.minutesString + ' remaining. Would you like to work on ' + taskText + ' for ' + timeString + ' until *' + calculatedTime + '* instead?';
	}

	convo.ask({
		text: question,
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			color: _constants.colorsHash.turquoise.hex,
			fallback: "I was unable to process your decision",
			actions: [{
				name: _constants.buttonValues.startNow.name,
				text: "Yes :punch:",
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
	}, [{
		pattern: _botResponses.utterances.containsChangeTask,
		callback: function callback(response, convo) {
			convo.say("Okay, let's change tasks!");
			askWhichTaskToWorkOn(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsChangeTime,
		callback: function callback(response, convo) {
			askForCustomTotalMinutes(convo);
			convo.next();
		}
	}, { // NL equivalent to buttonValues.startNow.value
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.sessionStart.confirmStart = true;
			convo.stop();
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
function askWhichTaskToWorkOn(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];


	// this should only be said FIRST_TIME_USER
	// convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

	var _convo$sessionStart2 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart2.SlackUserId;
	var dailyTasks = _convo$sessionStart2.dailyTasks;
	var dailyTask = _convo$sessionStart2.dailyTask;

	if (!dailyTasks) {
		getUserDailyTasks(convo);
	} else {
		(function () {
			var bot = convo.task.bot;

			var noDailyTask = false;
			var taskArray = dailyTasks.filter(function (currentDailyTask) {
				if (!dailyTask) {
					// uncommon situation where reminder has no dailyTask
					noDailyTask = true;
					return true;
				} else if (currentDailyTask.dataValues.id != dailyTask.dataValues.id) {
					return true;
				}
			});
			var options = { dontUsePriority: true };
			var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(taskArray, options);
			if (question == '') {
				question = 'Which task would you like to work on instead?';
			}
			if (noDailyTask) question = 'Which task would you like to work on?';
			var message = question + '\n' + taskListMessage;
			convo.ask({
				text: message,
				attachments: [{
					attachment_type: 'default',
					callback_id: "START_SESSION",
					fallback: "I was unable to process your decision",
					color: _constants.colorsHash.grey.hex,
					actions: [{
						name: _constants.buttonValues.neverMind.name,
						text: "Never mind!",
						value: _constants.buttonValues.neverMind.value,
						type: "button"
					}]
				}]
			}, [{
				pattern: _botResponses.utterances.noAndNeverMind,
				callback: function callback(response, convo) {
					var taskText = dailyTask.dataValues ? '`' + dailyTask.dataValues.Task.text + '`' : 'your task';
					convo.say('Sure thing! Let\'s stay working on ' + taskText);
					confirmTimeForTask(convo);
					convo.next();
				}
			}, {
				default: true,
				callback: function callback(response, convo) {
					// user inputed task #'s, not new task button
					confirmTasks(response, convo, taskArray);
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
			where: ['"DailyTask"."type" = ?', "live"],
			include: [_models2.default.Task]
		}).then(function (dailyTasks) {
			dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
			convo.sessionStart.dailyTasks = dailyTasks;
			askWhichTaskToWorkOn(convo);
		});
	});
}

// if user decides to work on existing tasks
function confirmTasks(response, convo) {
	var taskArray = arguments.length <= 2 || arguments[2] === undefined ? [] : arguments[2];
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var dailyTasks = convo.sessionStart.dailyTasks;


	if (taskArray.length == 0) {
		taskArray = dailyTasks;
	}

	var taskNumbersToWorkOnArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, taskArray);
	var taskIndexToWorkOn = taskNumbersToWorkOnArray[0] - 1;

	if (taskIndexToWorkOn >= 0) {
		if (taskNumbersToWorkOnArray.length == 1) {
			// SUCCESS
			convo.sessionStart.dailyTask = taskArray[taskIndexToWorkOn];
			confirmTimeForTask(convo);
		} else {
			// only one at a time
			convo.say("Let's work on one priority at a time!");
			var question = "Which of your remaining priorities do you want to work on?";
			askWhichTaskToWorkOn(convo, question);
		}
	} else {
		convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
		var _question = "Which of these do you want to work on?";
		askWhichTaskToWorkOn(convo, _question);
	}
}

// calculate ask about the time to the existing tasks user chose
function confirmTimeForTask(convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart3 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart3.SlackUserId;
	var tz = _convo$sessionStart3.tz;
	var dailyTask = _convo$sessionStart3.dailyTask;

	// will only be a single task now

	var minutes = dailyTask.dataValues.minutes;

	if (minutes) {
		var now = (0, _momentTimezone2.default)().tz(tz);
		var calculatedTimeObject = now.add(minutes, 'minutes');

		convo.sessionStart.minutes = minutes;
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
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart4 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart4.SlackUserId;
	var tz = _convo$sessionStart4.tz;
	var dailyTask = _convo$sessionStart4.dailyTask;

	// will only be a single task now

	var taskText = dailyTask.dataValues ? '`' + dailyTask.dataValues.Task.text + '`' : 'your task';

	convo.ask('How long do you want to work on ' + taskText + ' for?', function (response, convo) {
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
	var minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

	convo.sessionStart.calculatedTimeObject = customTimeObject;
	convo.sessionStart.minutes = minutes;

	finalizeTimeAndTasksToStart(convo);
}

/**
 * 		ACTUAL START SESSION ABSTRACTION
 */

function startSessionWithConvoObject(sessionStart) {

	// all of these constants are necessary!
	var bot = sessionStart.bot;
	var SlackUserId = sessionStart.SlackUserId;
	var dailyTask = sessionStart.dailyTask;
	var calculatedTimeObject = sessionStart.calculatedTimeObject;
	var UserId = sessionStart.UserId;
	var minutes = sessionStart.minutes;


	if (!bot || !SlackUserId || !UserId || !dailyTask || !calculatedTimeObject || !minutes) {
		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
			convo.say("Uh oh, something went wrong trying to `start your session` :dog: Let me know when you want to try again!");
		});
		return;
	}

	var startTime = (0, _momentTimezone2.default)();
	if (!dailyTask.dataValues.minutes) {
		// update dailyTask minutes here cause it hasn't existed up to this point
		var DailyTaskId = dailyTask.dataValues.id;
		_models2.default.DailyTask.update({
			minutes: minutes
		}, {
			where: ['"id" = ? ', DailyTaskId]
		});
	}
	// endTime is from when you hit start
	var endTime = (0, _momentTimezone2.default)().add(minutes, 'minutes');

	_models2.default.WorkSession.create({
		UserId: UserId,
		startTime: startTime,
		endTime: endTime
	}).then(function (workSession) {

		var dailyTaskIds = [dailyTask.dataValues.id];
		workSession.setDailyTasks(dailyTaskIds);

		var taskString = dailyTask.dataValues.Task.text;
		var minutesString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
		var timeString = endTime.format("h:mma");

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			convo.say("Let's do it :boom:!");
			convo.say('Good luck with `' + taskString + '`! See you in ' + minutesString + ' at *' + timeString + '*');
			convo.say({
				text: 'Your focused work session starts now :weight_lifter:',
				attachments: _constants.startSessionOptionsAttachments
			});
		});
	});
}
//# sourceMappingURL=startWorkSessionFunctions.js.map