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
	var attachmentsConfig = { defaultBreakTime: defaultBreakTime };
	var minutesDifference = minutes - minutesSpent;
	var timeSpentString = (0, _messageHelpers.convertMinutesToHoursString)(minutesSpent);

	var finishedTimeToTask = minutesSpent >= minutes ? true : false;

	if (!finishedTimeToTask && doneSessionEarly) {
		convo.say('Cool, let\'s end early!');
	}

	if (sessionTimerUp) {
		buttonsValuesArray = [_constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.extendSession.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.endDay.value];
		// triggered by sessionTimerUp
		if (finishedTimeToTask) {} else {}
	} else {
		// NL "done session"
		if (finishedTimeToTask) {
			buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriority.value, _constants.buttonValues.doneSession.notDone.value, _constants.buttonValues.doneSession.endDay.value];

			text = 'Great work! The time you allotted for `' + taskText + '` is up -- you\'ve worked for ' + timeSpentString + ' on this. Would you like to mark it as complete for the day?';
		} else {
			buttonsValuesArray = [_constants.buttonValues.doneSession.completedPriority.value, _constants.buttonValues.doneSession.takeBreak.value, _constants.buttonValues.doneSession.viewPlan.value, _constants.buttonValues.doneSession.endDay.value];

			text = 'You\'ve worked for ' + workSessionTimeString + ' on `' + taskText + '` and have ' + minutesDifference + ' minutes remaining';
		}
	}

	attachmentsConfig.buttonsValuesArray = buttonsValuesArray;
	var attachments = (0, _messageHelpers.getDoneSessionMessageAttachments)(attachmentsConfig);

	convo.ask({
		text: text,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {}
	}, {
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {}
	}, {
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {}
	}, {
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {}
	}, {
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {}
	}, {
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {}
	}, {
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {}
	}]);
}
//# sourceMappingURL=endWorkSessionFunctions.js.map