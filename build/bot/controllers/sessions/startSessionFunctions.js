'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.finalizeSessionTimeAndContent = finalizeSessionTimeAndContent;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm task and time in one place and start if it's good
function finalizeSessionTimeAndContent(convo) {
	var _convo$sessionStart = convo.sessionStart;
	var SlackUserId = _convo$sessionStart.SlackUserId;
	var tz = _convo$sessionStart.tz;
	var content = _convo$sessionStart.content;
	var minutes = _convo$sessionStart.minutes;
	var currentSession = _convo$sessionStart.currentSession;

	// we need both time and task in order to start session

	if (!content) {
		askForSessionContent(convo);
		return;
	} else if (!minutes) {
		askForSessionTime(convo);
		return;
	}

	// will only be a single task now
	var taskText = dailyTask.dataValues ? '`' + dailyTask.dataValues.Task.text + '`' : 'your task';

	// will only be a single task now
	var timeString = (0, _messageHelpers.convertMinutesToHoursString)(minutes);
	var calculatedTime = calculatedTimeObject.format("h:mma");

	var question = 'Ready to work on ' + taskText + ' for ' + timeString + ' until *' + calculatedTime + '*?';

	// already in session, can only be in one
	if (currentSession) {

		question = 'You\'re currently in a session for `' + currentSession.dataValues.content + '` and *NEED_MINUTES* remaining! Would you like to cancel that and start a new session instead?';
		convo.ask(question, [{
			pattern: _constants.utterances.yes,
			callback: function callback(response, convo) {
				convo.sessionStart.confirmOverRideSession = true;
				convo.say('Okay, sounds good to me!');
				convo.next();
			}
		}, {
			pattern: _constants.utterances.no,
			callback: function callback(response, convo) {

				var text = '';
				convo.say('Okay! Good luck and see you in *NEED_MINUTES*');
				convo.next();
			}
		}, {
			default: true,
			callback: function callback(response, convo) {
				convo.say("Sorry, I didn't catch that");
				convo.repeat();
				convo.next();
			}
		}]);
	} else {

		convo.sessionStart.confirmStart = true;
	}
}

/**
 *    CHOOSE SESSION TASK
 */
// ask which task the user wants to work on
function askForSessionContent(convo) {
	var SlackUserId = convo.sessionStart.SlackUserId;


	var sessionExample = getRandomExample("session");

	convo.ask({
		text: 'What would you like to focus on right now? (i.e. `' + sessionExample + '`)',
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
		pattern: _constants.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Okay! Let me know when you want to `start a session`');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			// optionally accept time here
			var _response$intentObjec = response.intentObject.entities;
			var reminder = _response$intentObjec.reminder;
			var duration = _response$intentObjec.duration;
			var datetime = _response$intentObjec.datetime;

			var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(response, tz);
			if (customTimeObject) {
				var now = (0, _momentTimezone2.default)().tz(tz);
				var minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				convo.sessionStart.minutes = minutes;
				convo.next();
			}

			// reminder is necessary to be session content
			if (reminder) {
				convo.sessionStart.content = reminder[0].value;
				finalizeSessionTimeAndContent(convo);
			} else {
				convo.say('I didn\'t get that');
				convo.repeat();
			}
			convo.next();
		}
	}]);
}

function askForSessionTime(convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart2 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart2.SlackUserId;
	var tz = _convo$sessionStart2.tz;
	var content = _convo$sessionStart2.content;
	var minutes = _convo$sessionStart2.minutes;

	// get time to session

	convo.ask({
		text: 'How long would you like to work on `' + content + '`?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			fallback: "How long do you want to work on this?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.changeTasks.name,
				text: "Wait, change task",
				value: _constants.buttonValues.changeTasks.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.utterances.containsChange,
		callback: function callback(response, convo) {
			convo.say('Okay, let\'s change tasks');
			convo.sessionStart.content = false;
			finalizeSessionTimeAndContent(convo);;
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			var now = (0, _momentTimezone2.default)().tz(tz);
			var entities = response.intentObject.entities;
			// for time to tasks, these wit intents are the only ones that makes sense

			var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(response, tz);
			if (customTimeObject) {
				var _minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				convo.sessionStart.minutes = _minutes;
				finalizeSessionTimeAndContent(convo);
				convo.next();
			} else {
				// invalid
				convo.say("I'm sorry, I didn't catch that :dog:");
				var question = 'How much more time did you want to add to `' + content + '` today?';
				convo.repeat();
			}

			convo.next();
		}
	}]);

	convo.next();
}
//# sourceMappingURL=startSessionFunctions.js.map