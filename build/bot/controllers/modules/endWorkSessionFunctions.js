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
			convo.say("You want to take a break!");
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
//# sourceMappingURL=endWorkSessionFunctions.js.map