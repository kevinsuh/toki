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

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

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
	var attachmentsConfig = { defaultBreakTime: defaultBreakTime, defaultSnoozeTime: defaultSnoozeTime };
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

			buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriority.value, _constants.buttonValues.doneSession.notDone.value, _constants.buttonValues.doneSession.extendSession.value, _constants.buttonValues.doneSession.endDay.value];
		} else {

			// send message if time is still remaining
			convo.say('Your session for `' + taskText + '` is up. Excellent work!');

			buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.extendSession.value, _constants.buttonValues.doneSession.completedPriorityTonedDown.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.endDay.value];
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

	attachmentsConfig.buttonsValuesArray = buttonsValuesArray;
	var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);

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
		pattern: _botResponses.utterances.onlyContainsExtend,
		callback: function callback(response, convo) {
			convo.say("You want to extend your session!");
			convo.next();
		}
	}, { // viewPlan
		pattern: _botResponses.utterances.containsPlan,
		callback: function callback(response, convo) {
			convo.say("You want to view your plan!");
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
			convo.say("You aren't done with your priority yet!");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			convo.say("Sorry, I didn't get that :thinking_face:");
		}
	}]);
}

// handle break time
// if button click: default break time
// if NL, default if no duration or datetime suggested
function getBreakTime(response, convo) {
	var text = response.text;
	var _response$intentObjec = response.intentObject.entities;
	var duration = _response$intentObjec.duration;
	var datetime = _response$intentObjec.datetime;
	var _convo$sessionDone2 = convo.sessionDone;
	var tz = _convo$sessionDone2.tz;
	var defaultBreakTime = _convo$sessionDone2.defaultBreakTime;
	var UserId = _convo$sessionDone2.UserId;

	var now = (0, _momentTimezone2.default)();

	var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
	if (!customTimeObject) {

		// use default break time if it doesn't exist!
		if (!defaultBreakTime && UserId) {
			convo.say('I recommend taking a break after working in a focused session -- it helps you stay fresh and focus even better when you jump back into your work');
			convo.say('The default break time is *' + _constants.TOKI_DEFAULT_BREAK_TIME + ' minutes*, but you can change it in your settings by telling me to `show settings`, or you can set a custom break time after any session by saying `break for 20 minutes`, or something like that :grinning:');
			// first time not updating at convo end...
			_models2.default.User.update({
				defaultBreakTime: 10
			}, {
				where: ['"Users"."id" = ?', UserId]
			});
		}

		customTimeObject = (0, _momentTimezone2.default)().add(_constants.TOKI_DEFAULT_BREAK_TIME, 'minutes');
	}

	var customTimeString = customTimeObject.format("h:mm a");
	var durationMinutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());

	if (!defaultBreakTime && UserId) {
		convo.say('I set your default break time to ' + durationMinutes + ' minutes and will check with you then');
	}

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
//# sourceMappingURL=endWorkSessionFunctions.js.map