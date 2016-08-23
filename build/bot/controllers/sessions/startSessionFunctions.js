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

	// already in session, can only be in one
	if (currentSession) {

		question = 'You\'re currently in a session for `' + currentSession.dataValues.content + '` and *NEED_MINUTES* remaining! Would you like to cancel that and start a new session instead?';
		convo.ask(question, [{
			pattern: _constants.utterances.yes,
			callback: function callback(response, convo) {
				convo.say('Okay, sounds good to me!');
				convo.sessionStart.minutes = false;
				convo.sessionStart.content = false;
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

		var now = (0, _momentTimezone2.default)().tz(tz);
		var calculatedTimeObject = now.add(minutes, 'minutes');
		var calculatedTimeString = calculatedTimeObject.format("h:mma");

		convo.say(':weight_lifter: You’re now in a focused session on `' + content + '` until *' + calculatedTimeString + '* :weight_lifter:');

		convo.sessionStart.confirmStart = true;
	}
}

/**
 *    CHOOSE SESSION TASK
 */
// ask which task the user wants to work on
function askForSessionContent(convo) {
	var _convo$sessionStart2 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart2.SlackUserId;
	var tz = _convo$sessionStart2.tz;
	var content = _convo$sessionStart2.content;
	var minutes = _convo$sessionStart2.minutes;


	var sessionExample = (0, _messageHelpers.getRandomExample)("session");

	convo.ask({
		text: 'What would you like to focus on right now? (i.e. `' + sessionExample + '`)',
		attachments: [{
			attachment_type: 'default',
			callback_id: "START_SESSION",
			fallback: "Let's get focused!"
		}]
	}, [{
		pattern: _constants.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Okay! Let me know when you want to `get focused`');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var reminder = response.intentObject.entities.reminder;

			// reminder is necessary to be session content

			if (reminder) {

				// optionally accept time here
				var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(response, tz);
				if (customTimeObject) {
					var now = (0, _momentTimezone2.default)().tz(tz);
					var _minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
					convo.sessionStart.minutes = _minutes;
					convo.next();
				}

				convo.sessionStart.content = reminder[0].value;
				finalizeSessionTimeAndContent(convo);
			} else {
				convo.say('I didn\'t get that :thinking_face:');
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
	var _convo$sessionStart3 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart3.SlackUserId;
	var tz = _convo$sessionStart3.tz;
	var content = _convo$sessionStart3.content;
	var minutes = _convo$sessionStart3.minutes;

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
			convo.say('Okay, let\'s change tasks!');
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
				var _minutes2 = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				convo.sessionStart.minutes = _minutes2;
				finalizeSessionTimeAndContent(convo);
				convo.next();
			} else {
				// invalid
				convo.say("I'm sorry, I didn't catch that :dog:");
				var _question = 'How much more time did you want to add to `' + content + '` today?';
				convo.repeat();
			}

			convo.next();
		}
	}]);

	convo.next();
}
//# sourceMappingURL=startSessionFunctions.js.map