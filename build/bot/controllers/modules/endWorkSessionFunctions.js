'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.doneSessionAskOptions = doneSessionAskOptions;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		END WORK SESSION CONVERSATION FLOW FUNCTIONS
 */
function doneSessionAskOptions(convo) {
	var _convo$sessionDone = convo.sessionDone;
	var defaultBreakTime = _convo$sessionDone.defaultBreakTime;
	var defaultSnoozeTime = _convo$sessionDone.defaultSnoozeTime;
	var doneSessionEarly = _convo$sessionDone.doneSessionEarly;
	var sessionTimerUp = _convo$sessionDone.sessionTimerUp;
	var _convo$sessionDone$cu = _convo$sessionDone.currentSession;
	var dailyTask = _convo$sessionDone$cu.dailyTask;
	var workSessionTimeString = _convo$sessionDone$cu.workSessionTimeString;

	// minutesSpent is updated here, after closing the workSession

	var _dailyTask$dataValues = dailyTask.dataValues;
	var minutesSpent = _dailyTask$dataValues.minutesSpent;
	var minutes = _dailyTask$dataValues.minutes;

	var taskText = dailyTask.Task.text;

	var text = void 0;
	var buttonsValuesArray = [];
	var minutesDifference = minutes - minutesSpent;
	var timeSpentString = (0, _messageHelpers.convertMinutesToHoursString)(minutesSpent);
	var minutesRemainingString = (0, _messageHelpers.convertMinutesToHoursString)(minutesDifference);

	var finishedTimeToTask = minutesSpent >= minutes ? true : false;

	if (!finishedTimeToTask && doneSessionEarly) {
		convo.say('Cool, let\'s end early!');
	}

	// provide customized attachments based on situation
	if (sessionTimerUp) {

		// triggered by sessionTimerUp

		if (finishedTimeToTask) {

			buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriority.value, _constants.buttonValues.doneSession.notDone.value, _constants.buttonValues.doneSession.extendSession.value, _constants.buttonValues.doneSession.didSomethingElse.value];
		} else {

			// send message if time is still remaining
			convo.say('Your session for `' + taskText + '` is up. Excellent work!');

			buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.extendSession.value, _constants.buttonValues.doneSession.completedPriorityTonedDown.value, _constants.buttonValues.doneSession.didSomethingElse.value, _constants.buttonValues.doneSession.beBackLater.value];
		}
	} else {

		// triggered by NL "done session"

		if (finishedTimeToTask) {
			buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriority.value, _constants.buttonValues.doneSession.notDone.value, _constants.buttonValues.doneSession.didSomethingElse.value];
		} else {

			buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.completedPriorityTonedDown.value, _constants.buttonValues.doneSession.didSomethingElse.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.beBackLater.value];
		}
	}

	// text is dependent on whether minutes remaining or not
	if (finishedTimeToTask) {
		text = 'Great work! The time you allotted for `' + taskText + '` is up -- you\'ve worked for ' + timeSpentString + ' on this. Would you like to mark it as complete for the day?';
	} else {
		text = 'You\'ve worked for ' + workSessionTimeString + ' on `' + taskText + '` and have ' + minutesRemainingString + ' remaining';
	}

	// if minutes is NULL, then we will have custom question
	if (!minutes) {
		text = 'You\'ve worked for ' + workSessionTimeString + ' on `' + taskText + '`. Did you complete this priority?';
	}

	var attachmentsConfig = { defaultBreakTime: defaultBreakTime, defaultSnoozeTime: defaultSnoozeTime, buttonsValuesArray: buttonsValuesArray };
	var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);
	convoAskDoneSessionOptions(convo, text, attachments);
}

function completePriorityForSession(convo) {
	var _convo$sessionDone2 = convo.sessionDone;
	var tz = _convo$sessionDone2.tz;
	var dailyTasks = _convo$sessionDone2.dailyTasks;
	var defaultBreakTime = _convo$sessionDone2.defaultBreakTime;
	var UserId = _convo$sessionDone2.UserId;
	var dailyTask = _convo$sessionDone2.currentSession.dailyTask;


	convo.sessionDone.priorityDecision.completeDailyTask = true;

	var unCompletedDailyTasks = dailyTasks.filter(function (currentDailyTask) {
		if (currentDailyTask.dataValues && currentDailyTask.dataValues.id != dailyTask.dataValues.id) {
			return true;
		}
	});

	var dailyTaskTexts = unCompletedDailyTasks.map(function (dailyTask) {
		return dailyTask.dataValues.Task.text;
	});

	var config = { codeBlock: true };
	var tasksString = (0, _messageHelpers.commaSeparateOutTaskArray)(dailyTaskTexts, config);

	convo.say('Let’s go! You’re one step closer to winning the day! You have ' + tasksString + ' remaining');

	var buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.newSession.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.beBackLater.value];

	var attachmentsConfig = { defaultBreakTime: defaultBreakTime, buttonsValuesArray: buttonsValuesArray };
	var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);

	var text = 'Let’s take a well-deserved break and get after it when you return';

	convoAskDoneSessionOptions(convo, text, attachments);

	convo.next();
}

// this will actually ask the convo options in a modular, DRY way
function convoAskDoneSessionOptions(convo, text, attachments) {

	convo.ask({
		text: text,
		attachments: attachments
	}, [{ // completedPriority
		pattern: _botResponses.utterances.containsCompleteOrCheckOrCross,
		callback: function callback(response, convo) {
			completePriorityForSession(convo);
			convo.next();
		}
	}, { // takeBreak
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {
			getBreakTime(response, convo);
			convo.next();
		}
	}, { // extendSession
		pattern: _botResponses.utterances.containsExtend,
		callback: function callback(response, convo) {
			getExtendSessionTime(response, convo);
			convo.next();
		}
	}, { // newSession
		pattern: _botResponses.utterances.containsNew,
		callback: function callback(response, convo) {
			convo.say('Alright, you\'re crushing it.');
			convo.sessionDone.postSessionDecision = _constants.intentConfig.START_SESSION;
			convo.next();
		}
	}, { // viewPlan
		pattern: _botResponses.utterances.containsPlan,
		callback: function callback(response, convo) {
			convo.say('Got it');
			convo.sessionDone.postSessionDecision = _constants.intentConfig.VIEW_PLAN;
			convo.next();
		}
	}, { // endDay
		pattern: _botResponses.utterances.endDay,
		callback: function callback(response, convo) {
			convo.sessionDone.postSessionDecision = _constants.intentConfig.END_PLAN;
			convo.next();
		}
	}, { // notDone
		pattern: _botResponses.utterances.notDone,
		callback: function callback(response, convo) {
			askForAdditionalTimeToPriority(response, convo);
			convo.next();
		}
	}, { // spentTimeOnSomethingElse
		pattern: _botResponses.utterances.somethingElse,
		callback: function callback(response, convo) {
			switchWorkedOnPriority(convo);
			convo.next();
		}
	}, { // spentTimeOnSomethingElse
		pattern: _botResponses.utterances.containsBackLater,
		callback: function callback(response, convo) {
			convo.say('Okay! I\'ll be here when you want to make progress with a `new session` :muscle:');
			convo.next();
		}
	}, {
		// no or never mind to exit this flow
		pattern: _botResponses.utterances.containsNoOrNeverMindOrNothing,
		callback: function callback(response, convo) {
			convo.say('Okay! I\'ll be here when you want to make progress with a `new session` :muscle:');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			text = "Sorry, I didn't get that :thinking_face:. What would you like to do?";
			attachments = [];
			convoAskDoneSessionOptions(convo, text, attachments);
			convo.next();
		}
	}]);
}

function askForAdditionalTimeToPriority(response, convo) {
	var _response$intentObjec = response.intentObject.entities;
	var duration = _response$intentObjec.duration;
	var datetime = _response$intentObjec.datetime;
	var _convo$sessionDone3 = convo.sessionDone;
	var tz = _convo$sessionDone3.tz;
	var dailyTasks = _convo$sessionDone3.dailyTasks;
	var defaultSnoozeTime = _convo$sessionDone3.defaultSnoozeTime;
	var defaultBreakTime = _convo$sessionDone3.defaultBreakTime;
	var UserId = _convo$sessionDone3.UserId;
	var dailyTask = _convo$sessionDone3.currentSession.dailyTask;
	var minutesSpent = dailyTask.dataValues.minutesSpent;

	var taskText = dailyTask.Task.text;

	var text = 'Got it - let\'s adjust your plan accordingly. *How much additional time* `i.e. 1 more hour` would you like to allocate to `' + taskText + '` for the rest of today?';
	var buttonsValuesArray = [_constants.buttonValues.doneSession.didSomethingElse.value, _constants.buttonValues.doneSession.moveOn.value];
	var attachmentsConfig = { buttonsValuesArray: buttonsValuesArray };
	var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);
	convo.ask({
		text: text,
		attachments: attachments
	}, [{ // spentTimeOnSomethingElse
		pattern: _botResponses.utterances.somethingElse,
		callback: function callback(response, convo) {

			var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
			convo.say(taskListMessage);
			askToReplacePriority(convo);
			convo.next();
		}
	}, { // moveOn
		pattern: _botResponses.utterances.moveOn,
		callback: function callback(response, convo) {
			var timeSpentString = (0, _messageHelpers.convertMinutesToHoursString)(minutesSpent);

			var buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.newSession.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.beBackLater.value];

			var attachmentsConfig = { defaultBreakTime: defaultBreakTime, buttonsValuesArray: buttonsValuesArray };
			var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);
			var text = 'Kudos! You spent ' + timeSpentString + ' on `' + taskText + '` today. Let’s take a break and queue up your next priority when you get back';
			convoAskDoneSessionOptions(convo, text, attachments);

			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			// default will be time. if no customTimeObject, repeat question
			var text = response.text;
			var _response$intentObjec2 = response.intentObject.entities;
			var duration = _response$intentObjec2.duration;
			var datetime = _response$intentObjec2.datetime;

			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
			var now = (0, _momentTimezone2.default)();

			if (!customTimeObject) {
				convo.say("Sorry, I didn't get that :thinking_face:");
				convo.repeat();
			} else {

				// success and user wants additional time to priority!

				var durationMinutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				convo.sessionDone.currentSession.additionalMinutes = durationMinutes;

				var _buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.newSession.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.beBackLater.value];

				var _attachmentsConfig = { defaultBreakTime: defaultBreakTime, buttonsValuesArray: _buttonsValuesArray };
				var _attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(_attachmentsConfig);
				var _text = 'Got it! I added ' + durationMinutes + ' minutes to this priority. Would you like to take a break?';
				convoAskDoneSessionOptions(convo, _text, _attachments);
			}

			convo.next();
		}
	}]);
}

function switchWorkedOnPriority(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var _convo$sessionDone4 = convo.sessionDone;
	var dailyTasks = _convo$sessionDone4.dailyTasks;
	var defaultBreakTime = _convo$sessionDone4.defaultBreakTime;


	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
	if (question == '') {
		question = 'Which one of your ' + dailyTasks.length + ' remaining priorities did you work on?\n' + taskListMessage;
	}

	var buttonsValuesArray = [_constants.buttonValues.doneSession.itWasSomethingElse.value, _constants.buttonValues.neverMind.value];

	var text = question;
	var attachmentsConfig = { buttonsValuesArray: buttonsValuesArray };
	var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);

	convo.ask({
		text: text,
		attachments: attachments
	}, [{ // spentTimeOnSomethingElse
		pattern: _botResponses.utterances.somethingElse,
		callback: function callback(response, convo) {
			askToReplacePriority(convo);
			convo.next();
		}
	}, {
		// never mind
		pattern: _botResponses.utterances.containsNoOrNeverMindOrNothing,
		callback: function callback(response, convo) {

			var buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriorityTonedDown.value, _constants.buttonValues.doneSession.didSomethingElse.value, _constants.buttonValues.doneSession.notDone.value, _constants.buttonValues.doneSession.extendSession.value];

			var attachmentsConfig = { defaultBreakTime: defaultBreakTime, buttonsValuesArray: buttonsValuesArray };
			var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);
			var text = 'Okay! What would you like to do with this session?';
			convoAskDoneSessionOptions(convo, text, attachments);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			// needs to be a number, else repeat question
			var taskNumberArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
			if (taskNumberArray && taskNumberArray.length == 1) {

				var taskNumber = taskNumberArray[0]; // only one

				var dailyTaskIndexToSwitch = taskNumber - 1;
				convo.sessionDone.priorityDecision.switchPriority.newPriorityIndex = dailyTaskIndexToSwitch;

				convo.next();
			} else {
				// error
				var _question = "Sorry, I didn't get that :thinking_face:. Let me know which priority you want to replace above `i.e. priority 2`";
				askToReplacePriority(convo, _question);
				convo.next();
			}
		}
	}]);
}

function askToReplacePriority(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var _convo$sessionDone5 = convo.sessionDone;
	var defaultBreakTime = _convo$sessionDone5.defaultBreakTime;
	var dailyTasks = _convo$sessionDone5.dailyTasks;
	var dailyTask = _convo$sessionDone5.currentSession.dailyTask;


	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
	if (question == '') {
		question = 'Okay! If you want to log this with me, it will replace one of your priorities. Which priority above would you like to replace?';
	}

	var buttonsValuesArray = [_constants.buttonValues.doneSession.keepMyPriority.value];
	var attachmentsConfig = { defaultBreakTime: defaultBreakTime, buttonsValuesArray: buttonsValuesArray };
	var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);
	var text = question;

	convo.ask({
		text: text,
		attachments: attachments
	}, [{ // keepPriority
		pattern: _botResponses.utterances.containsKeep,
		callback: function callback(response, convo) {

			var buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.newSession.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.beBackLater.value];

			var attachmentsConfig = { defaultBreakTime: defaultBreakTime, buttonsValuesArray: buttonsValuesArray };
			var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);
			var text = 'Good work! Now let’s refocus back on another priority for today after a quick break';
			convoAskDoneSessionOptions(convo, text, attachments);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			// needs to be a number, else repeat question
			var taskNumberArray = (0, _messageHelpers.convertTaskNumberStringToArray)(response.text, dailyTasks);
			if (taskNumberArray && taskNumberArray.length == 1) {

				var taskNumber = taskNumberArray[0]; // only one

				var dailyTaskIndexToReplace = taskNumber - 1;
				convo.sessionDone.priorityDecision.replacePriority.dailyTaskIndexToReplace = dailyTaskIndexToReplace;
				askForPriorityReplacement(convo);
				convo.next();
			} else {
				// error
				var _question2 = "Sorry, I didn't get that :thinking_face:. Let me know which priority you want to replace above `i.e. priority 2`";
				askToReplacePriority(convo, _question2);
				convo.next();
			}
		}
	}]);
}

function askForPriorityReplacement(convo) {
	var _convo$sessionDone6 = convo.sessionDone;
	var dailyTasks = _convo$sessionDone6.dailyTasks;
	var dailyTaskIndexToReplace = _convo$sessionDone6.priorityDecision.replacePriority.dailyTaskIndexToReplace;
	var dailyTask = _convo$sessionDone6.currentSession.dailyTask;


	if (dailyTasks[dailyTaskIndexToReplace]) {

		var dailyTaskToReplace = dailyTasks[dailyTaskIndexToReplace];
		var taskTextToReplace = dailyTaskToReplace.dataValues.Task.text;

		convo.ask('What did you do instead of `' + taskTextToReplace + '`?', function (response, convo) {
			// DONE with this flow. all we need is which dailyTask to replace, and what text of newDailyTask will be.
			var newTaskText = response.text;
			convo.sessionDone.priorityDecision.replacePriority.newTaskText = newTaskText;
			convo.next();
		});
	} else {
		var question = "What priority would you like to replace?";
		askToReplacePriority(convo, question);
		convo.next();
	}
}

// handle break time
// if button click: default break time
// if NL, default if no duration or datetime suggested
function getBreakTime(response, convo) {
	var text = response.text;
	var _response$intentObjec3 = response.intentObject.entities;
	var duration = _response$intentObjec3.duration;
	var datetime = _response$intentObjec3.datetime;
	var _convo$sessionDone7 = convo.sessionDone;
	var tz = _convo$sessionDone7.tz;
	var defaultBreakTime = _convo$sessionDone7.defaultBreakTime;
	var UserId = _convo$sessionDone7.UserId;

	var now = (0, _momentTimezone2.default)();

	var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
	if (!customTimeObject) {

		// use default break time if it doesn't exist!
		if (!defaultBreakTime && UserId) {
			convo.say('I recommend taking a break after working in a focused session -- it helps you stay fresh and focus even better when you jump back into your work');
			convo.say('The default break time is *' + _constants.TOKI_DEFAULT_BREAK_TIME + ' minutes*, but you can change it in your settings by telling me to `show settings`, or you can set a custom break time after any session by saying `break for 20 minutes`, or something like that :grinning:');
			// first time not updating at convo end...
			_models2.default.User.update({
				defaultBreakTime: _constants.TOKI_DEFAULT_BREAK_TIME
			}, {
				where: ['"Users"."id" = ?', UserId]
			});
			customTimeObject = (0, _momentTimezone2.default)().tz(tz).add(_constants.TOKI_DEFAULT_BREAK_TIME, 'minutes');
		} else {
			customTimeObject = (0, _momentTimezone2.default)().tz(tz).add(defaultBreakTime, 'minutes');
		}
	}

	var customTimeString = customTimeObject.format("h:mm a");
	var durationMinutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

	if (!defaultBreakTime && UserId) {
		convo.say('I set your default break time to ' + durationMinutes + ' minutes and will check with you then');
	}

	// push the reminder
	convo.sessionDone.reminders.push({
		customNote: 'It\'s been ' + durationMinutes + ' minutes. Let me know when you\'re ready to start a session',
		remindTime: customTimeObject,
		type: "break"
	});

	/**
  * 	MAIN BREAK MESSAGE
  */
	convo.say({
		text: 'See you in ' + durationMinutes + ' minutes -- I\'ll let you know when your break is over :palm_tree:',
		attachments: _constants.endBreakEarlyAttachments
	});

	convo.next();
}

// handle break time
// if button click: default break time
// if NL, default if no duration or datetime suggested
function getExtendSessionTime(response, convo) {
	var text = response.text;
	var _response$intentObjec4 = response.intentObject.entities;
	var duration = _response$intentObjec4.duration;
	var datetime = _response$intentObjec4.datetime;
	var _convo$sessionDone8 = convo.sessionDone;
	var tz = _convo$sessionDone8.tz;
	var defaultSnoozeTime = _convo$sessionDone8.defaultSnoozeTime;
	var UserId = _convo$sessionDone8.UserId;
	var dailyTask = _convo$sessionDone8.currentSession.dailyTask;

	var now = (0, _momentTimezone2.default)();

	var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
	if (!customTimeObject) {

		// use default break time if it doesn't exist!
		if (!defaultSnoozeTime && UserId) {
			convo.say('Sure thing! Extend Session is all about keeping you in the flow (for future sessions :grin:)');
			convo.say('You can either hit the Extend Session button, which defaults to *' + _constants.TOKI_DEFAULT_SNOOZE_TIME + '* minutes, or let me know how long you want to extend by saying `extend by 30 minutes` or `extend until 1pm` to keep your current session rolling');
			convo.say('It’s good to take breaks after focusing for long periods of time, but I want to help you facilitate flow and get out of your way when you’re feeling it :raised_hands:');
			// first time not updating at convo end...
			_models2.default.User.update({
				defaultSnoozeTime: _constants.TOKI_DEFAULT_SNOOZE_TIME
			}, {
				where: ['"Users"."id" = ?', UserId]
			});
			customTimeObject = (0, _momentTimezone2.default)().tz(tz).add(_constants.TOKI_DEFAULT_SNOOZE_TIME, 'minutes');
		} else {
			customTimeObject = (0, _momentTimezone2.default)().tz(tz).add(defaultSnoozeTime, 'minutes');
		}
	}

	var customTimeString = customTimeObject.format("h:mm a");
	var durationMinutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

	// the extend session time object
	convo.sessionDone.extendSession = customTimeObject;

	if (!defaultSnoozeTime && UserId) {
		convo.say({
			text: 'I’ll see you at *' + customTimeString + '*! :clock1230: _(P.S. you can change your default extend by saying `show settings`)_',
			attachments: _constants.startSessionOptionsAttachments
		});
	} else {
		/**
   * 	MAIN EXREND SESSION MESSAGE
   */
		var taskText = dailyTask.Task.text;
		convo.say({
			text: 'You\'re unstoppable! Keep cranking on `' + taskText + '` :wrench: and I\'ll see you in ' + durationMinutes + ' minutes at *' + customTimeString + '*',
			attachments: _constants.startSessionOptionsAttachments
		});
	}

	convo.next();
}
//# sourceMappingURL=endWorkSessionFunctions.js.map