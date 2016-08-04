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

	var finishedTimeToTask = minutesSpent >= minutes ? true : false;

	if (!finishedTimeToTask && doneSessionEarly) {
		convo.say('Cool, let\'s end early!');
	}

	// provide customized attachments based on situation
	if (sessionTimerUp) {

		// triggered by sessionTimerUp

		if (finishedTimeToTask) {

			buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriority.value, _constants.buttonValues.doneSession.notDone.value, _constants.buttonValues.doneSession.didSomethingElse.value, _constants.buttonValues.doneSession.extendSession.value];
		} else {

			// send message if time is still remaining
			convo.say('Your session for `' + taskText + '` is up. Excellent work!');

			buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.extendSession.value, _constants.buttonValues.doneSession.completedPriorityTonedDown.value, _constants.buttonValues.doneSession.didSomethingElse.value, _constants.buttonValues.doneSession.viewPlan.value];
		}
	} else {

		// triggered by NL "done session"

		if (finishedTimeToTask) {
			buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriority.value, _constants.buttonValues.doneSession.notDone.value, _constants.buttonValues.doneSession.endDay.value];
		} else {

			buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriority.value, _constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.endDay.value];
		}
	}

	// text is dependent on whether minutes remaining or not
	if (finishedTimeToTask) {
		text = 'Great work! The time you allotted for `' + taskText + '` is up -- you\'ve worked for ' + timeSpentString + ' on this. Would you like to mark it as complete for the day?';
	} else {
		text = 'You\'ve worked for ' + workSessionTimeString + ' on `' + taskText + '` and have ' + minutesDifference + ' minutes remaining';
	}

	var attachmentsConfig = { defaultBreakTime: defaultBreakTime, defaultSnoozeTime: defaultSnoozeTime, buttonsValuesArray: buttonsValuesArray };
	var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);
	convoAskDoneSessionOptions(convo, text, attachments);
}

// this will actually ask the convo options in a modular, DRY way
function convoAskDoneSessionOptions(convo, text, attachments) {

	convo.ask({
		text: text,
		attachments: attachments
	}, [{ // completedPriority
		pattern: _botResponses.utterances.containsCompleteOrCheckOrCross,
		callback: function callback(response, convo) {
			convo.say("You want to complete your priority!");
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
			convo.say("You want a new session!");
			convo.next();
		}
	}, { // viewPlan
		pattern: _botResponses.utterances.containsPlan,
		callback: function callback(response, convo) {
			convo.sessionDone.postSessionDecision = _constants.intentConfig.VIEW_PLAN;
			convo.next();
		}
	}, { // endDay
		pattern: _botResponses.utterances.endDay,
		callback: function callback(response, convo) {
			convo.say("You want to end your day!");
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
			askToReplacePriority(convo);
			convo.next();
		}
	}, {
		// no or never mind to exit this flow
		pattern: _botResponses.utterances.containsNoOrNeverMindOrNothing,
		callback: function callback(response, convo) {
			convo.say('Okay! Let me know when you want to make progress on `another priority` :muscle:');
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
	var _convo$sessionDone2 = convo.sessionDone;
	var tz = _convo$sessionDone2.tz;
	var dailyTasks = _convo$sessionDone2.dailyTasks;
	var defaultSnoozeTime = _convo$sessionDone2.defaultSnoozeTime;
	var UserId = _convo$sessionDone2.UserId;
	var dailyTask = _convo$sessionDone2.currentSession.dailyTask;


	var taskText = dailyTask.Task.text;
	var text = 'Got it - let\'s adjust your plan accordingly. How much additional time would you like to allocate to `' + taskText + '` for the rest of today?';
	buttonsValuesArray = [_constants.buttonValues.doneSession.didSomethingElse.value, _constants.buttonValues.doneSession.moveOn.value];
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
	}, { // moveOn
		pattern: _botResponses.utterances.moveOn,
		callback: function callback(response, convo) {

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
				convo.sessionDone.additionalMinutes = durationMinutes;

				var _buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.newSession.value, _constants.buttonValues.doneSession.viewPlan.value];

				var _attachmentsConfig = { defaultBreakTime: defaultBreakTime, defaultSnoozeTime: defaultSnoozeTime, buttonsValuesArray: _buttonsValuesArray };
				var _attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(_attachmentsConfig);
				var _text = 'Got it! I added ' + durationMinutes + ' minutes to this priority. Would you like to take a break?';
				convoAskDoneSessionOptions(convo, _text, _attachments);
			}

			convo.next();
		}
	}]);
}

function askToReplacePriority(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var _convo$sessionDone3 = convo.sessionDone;
	var dailyTasks = _convo$sessionDone3.dailyTasks;
	var dailyTask = _convo$sessionDone3.currentSession.dailyTask;


	var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
	if (question == '') {
		question = 'Great! If you want to log this with me, it will replace one of your priorities. Which priority would you like to replace?\n' + taskListMessage;
	}

	convo.ask({
		text: question,
		attachments: [{
			attachment_type: 'default',
			callback_id: "REPLACE_PRIORITY",
			fallback: "Do you want to replace a priority?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.keepPriority.name,
				text: "I'll keep my priorities",
				value: _constants.buttonValues.keepPriority.value,
				type: "button"
			}]
		}]
	}, [{ // keepPriority
		pattern: _botResponses.utterances.containsKeep,
		callback: function callback(response, convo) {

			var buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.newSession.value, _constants.buttonValues.doneSession.viewPlan.value];

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
				convo.sessionDone.replacePriority.dailyTaskIndexToReplace = dailyTaskIndexToReplace;
				askForPriorityReplacement(convo);
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

function askForPriorityReplacement(convo) {
	var _convo$sessionDone4 = convo.sessionDone;
	var dailyTasks = _convo$sessionDone4.dailyTasks;
	var dailyTaskIndexToReplace = _convo$sessionDone4.replacePriority.dailyTaskIndexToReplace;
	var dailyTask = _convo$sessionDone4.currentSession.dailyTask;


	if (dailyTaskIndexToReplace) {

		var _dailyTaskToReplace = dailyTasks[dailyTaskIndexToReplace];
		var taskTextToReplace = _dailyTaskToReplace.dataValues.Task.text;

		convo.ask('What did you do instead of `' + taskTextToReplace + '`?', function (response, convo) {
			var newTaskText = response.text;
			convo.sessionDone.replacePriority.newTaskText = newTaskText;
			convo.ask({
				text: 'Did you complete `' + newTaskText + '`?',
				attachments: []
			}, [{
				pattern: _botResponses.utterances.yes,
				callback: function callback(response, convo) {
					convo.say('You\'re a star :star:. I updated your plan!');
					convo.sessionDone.postSessionDecision = _constants.intentConfig.VIEW_PLAN;
					convo.next();
				}
			}, {
				pattern: _botResponses.utterances.no,
				callback: function callback(response, convo) {
					askForTimeToReplacementPriority(convo);
					convo.next();
				}
			}, {
				default: true,
				callback: function callback(response, convo) {
					convo.say('Hmm I didn\'t get that :thinking_face:');
					convo.repeat();
					convo.next();
				}
			}]);
			convo.next();
		});
	} else {
		var question = "What priority would you like to replace?";
		askToReplacePriority(convo, question);
		convo.next();
	}
}

function askForTimeToReplacementPriority(convo) {
	var _convo$sessionDone5 = convo.sessionDone;
	var tz = _convo$sessionDone5.tz;
	var _convo$sessionDone5$r = _convo$sessionDone5.replacePriority;
	var dailyTaskIndexToReplace = _convo$sessionDone5$r.dailyTaskIndexToReplace;
	var newTaskText = _convo$sessionDone5$r.newTaskText;


	if (newTaskText) {
		convo.ask('How much more time would you like to put toward `' + newTaskText + '`?', function (response, convo) {
			// needs to be time
			var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
			if (customTimeObject) {

				var now = (0, _momentTimezone2.default)();
				var durationMinutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				convo.replacePriority.additionalMinutes = durationMinutes;

				replaceDailyTasksWithNewPriority(convo);
				convo.say('This looks great! I updated your plan!');
				convo.sessionDone.postSessionDecision = _constants.intentConfig.VIEW_PLAN;
				convo.next();
			} else {
				convo.say('Huh, I didn\'t get a time from you :thinking_face:. Say something like `30 more minutes`!');
				convo.repeat();
				convo.next();
			}
		});
	} else {
		askForPriorityReplacement(convo);
		convo.next();
	}
}

function replaceDailyTasksWithNewPriority(convo) {
	var _convo$sessionDone6 = convo.sessionDone;
	var _convo$sessionDone6$r = _convo$sessionDone6.replacePriority;
	var dailyTaskIndexToReplace = _convo$sessionDone6$r.dailyTaskIndexToReplace;
	var newTaskText = _convo$sessionDone6$r.newTaskText;
	var additionalMinutes = _convo$sessionDone6$r.additionalMinutes;
	var dailyTasks = _convo$sessionDone6.dailyTasks;


	if (dailyTasks && dailyTaskIndexToReplace && newTaskText) {

		dailyTaskToReplace = dailyTasks[dailyTaskIndexToReplace];
		dailyTaskToReplace.text = newTaskText;
		dailyTaskToReplace.type = "live";

		if (additionalMinutes) {
			dailyTaskToReplace.minutes = additionalMinutes;
			dailyTaskToReplace.done = false;
		} else {
			dailyTaskToReplace.done = true;
		}

		convo.dailyTasks = dailyTasks;
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