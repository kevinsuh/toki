'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.confirmTimeZoneExistsThenStartSessionFlow = confirmTimeZoneExistsThenStartSessionFlow;

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

// confirm that user has tz configured before continuing
function confirmTimeZoneExistsThenStartSessionFlow(convo) {
	var text = arguments.length <= 1 || arguments[1] === undefined ? 'Ah! Since I help you make time for your priorities, I need to know your *timezone* before we continue' : arguments[1];
	var _convo$sessionStart = convo.sessionStart;
	var SlackUserId = _convo$sessionStart.SlackUserId;
	var UserId = _convo$sessionStart.UserId;
	var tz = _convo$sessionStart.tz;


	if (tz) {
		// user has tz config'd
		finalizeSessionTimeAndContent(convo); // entry point
		convo.next();
	} else {
		// user needs tz config'd!
		convo.ask({
			text: text,
			attachments: _constants.timeZoneAttachments
		}, function (response, convo) {
			var text = response.text;

			var timeZoneObject = false;
			switch (text) {
				case (text.match(_constants.utterances.eastern) || {}).input:
					timeZoneObject = _constants.timeZones.eastern;
					break;
				case (text.match(_constants.utterances.central) || {}).input:
					timeZoneObject = _constants.timeZones.central;
					break;
				case (text.match(_constants.utterances.mountain) || {}).input:
					timeZoneObject = _constants.timeZones.mountain;
					break;
				case (text.match(_constants.utterances.pacific) || {}).input:
					timeZoneObject = _constants.timeZones.pacific;
					break;
				case (text.match(_constants.utterances.other) || {}).input:
					timeZoneObject = _constants.timeZones.other;
					break;
				default:
					break;
			}

			if (!timeZoneObject) {
				convo.say("I didn't get that :thinking_face:");
				confirmTimeZoneExistsThenStartSessionFlow(convo, 'Which timezone are you in?');
				convo.next();
			} else if (timeZoneObject == _constants.timeZones.other) {
				convo.say('Sorry!');
				convo.say("Right now I’m only able to work in these timezones. If you want to demo Toki, just pick one of these timezones for now. I’ll try to get your timezone included as soon as possible!");
				confirmTimeZoneExistsThenStartSessionFlow(convo, 'Which timezone do you want to go with for now?');
				convo.next();
			} else {
				(function () {
					// success!!

					var _timeZoneObject = timeZoneObject;
					var tz = _timeZoneObject.tz;

					_models2.default.User.update({
						tz: tz
					}, {
						where: { id: UserId }
					}).then(function (user) {
						convo.say('Great! If this ever changes, you can always `update settings`');
						convo.sessionStart.tz = tz;
						finalizeSessionTimeAndContent(convo); // entry point
						convo.next();
					});
				})();
			}
		});
	}
}

// confirm task and time in one place and start if it's good
function finalizeSessionTimeAndContent(convo) {
	var _convo$sessionStart2 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart2.SlackUserId;
	var tz = _convo$sessionStart2.tz;
	var content = _convo$sessionStart2.content;
	var minutes = _convo$sessionStart2.minutes;
	var currentSession = _convo$sessionStart2.currentSession;
	var changeTimeAndTask = _convo$sessionStart2.changeTimeAndTask;


	if (currentSession) {

		/*
   * ONLY IF YOU'RE CURRENTLY IN A SESSION...
   */

		if (changeTimeAndTask) {
			// clicking button `change time + task`
			changeTimeAndTaskFlow(convo);
		} else {
			// wit `new session`
			askToOverrideCurrentSession(convo);
		}
	} else {

		/*
   * STANDARD FLOW
   */

		// we need both time and task in order to start session
		// if dont have either, will run function before `convo.next`

		if (!content) {
			askForSessionContent(convo);
			convo.next();
			return;
		} else if (!minutes) {
			askForSessionTime(convo);
			convo.next();
			return;
		}

		convo.say(" ");
		convo.sessionStart.confirmNewSession = true;
		convo.next();
	}

	convo.next();
}

function changeTimeAndTaskFlow(convo) {
	var _convo$sessionStart3 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart3.SlackUserId;
	var tz = _convo$sessionStart3.tz;
	var currentSession = _convo$sessionStart3.currentSession;

	// we are restarting data so user can seamlessly create a new session

	convo.sessionStart.content = currentSession.dataValues.content;
	convo.sessionStart.minutes = false;
	convo.sessionStart.currentSession = false;

	var text = 'Would you like to work on something other than `' + convo.sessionStart.content + '`?';
	var attachments = [{
		attachment_type: 'default',
		callback_id: "EXISTING_SESSION_OPTIONS",
		fallback: "Hey, you're already in a session!!",
		actions: [{
			name: _constants.buttonValues.yes.name,
			text: "Yes",
			value: _constants.buttonValues.yes.value,
			type: "button"
		}, {
			name: _constants.buttonValues.no.name,
			text: "Nah, keep it!",
			value: _constants.buttonValues.no.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: text,
		attachments: attachments
	}, [{
		pattern: _constants.utterances.yes,
		callback: function callback(response, convo) {
			convo.sessionStart.content = false;
			var question = 'What would you like to set your current priority as?';
			askForSessionContent(convo, question);
			convo.next();
		}
	}, {
		pattern: _constants.utterances.no,
		callback: function callback(response, convo) {
			finalizeSessionTimeAndContent(convo);
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
}

function askToOverrideCurrentSession(convo) {
	var _convo$sessionStart4 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart4.SlackUserId;
	var tz = _convo$sessionStart4.tz;
	var content = _convo$sessionStart4.content;
	var minutes = _convo$sessionStart4.minutes;
	var currentSession = _convo$sessionStart4.currentSession;


	var now = (0, _momentTimezone2.default)().tz(tz);
	var endTime = (0, _momentTimezone2.default)(currentSession.dataValues.endTime).tz(tz);
	var endTimeString = endTime.format("h:mma");
	var minutesLeft = Math.round(_momentTimezone2.default.duration(endTime.diff(now)).asMinutes());

	var text = 'Hey! You’ve already set your current priority as `' + currentSession.dataValues.content + '` until *' + endTimeString + '*';
	var attachments = [{
		attachment_type: 'default',
		callback_id: "EXISTING_SESSION_OPTIONS",
		fallback: "Hey, you're already in a session!!",
		actions: [{
			name: _constants.buttonValues.newSession.name,
			text: "New Priority :new:",
			value: '{"overrideNewSession": true}',
			type: "button"
		}]
	}];

	convo.say({
		text: text,
		attachments: attachments
	});

	convo.next();

	// convo.ask({
	// 	text,
	// 	attachments
	// }, [
	// 	{
	// 		pattern: utterances.containsNew,
	// 		callback: (response, convo) => {
	// 			convo.say(`Okay, sounds good to me!`);

	// 			// restart everything!
	// 			convo.sessionStart.minutes        = false;
	// 			convo.sessionStart.content        = false;
	// 			convo.sessionStart.currentSession = false;

	// 			finalizeSessionTimeAndContent(convo);
	// 			convo.next();
	// 		}
	// 	},
	// 	{
	// 		pattern: utterances.containsKeep,
	// 		callback: (response, convo) => {

	// 			convo.say(`You got this! Keep working on \`${currentSession.dataValues.content}\` and I’ll see you at *${endTimeString}*`);
	// 			convo.next();

	// 		}
	// 	},
	// 	{
	// 		default: true,
	// 		callback: (response, convo) => {
	// 			convo.say("Sorry, I didn't catch that");
	// 			convo.repeat();
	// 			convo.next();
	// 		}
	// 	}
	// ]);
}

/**
 *    CHOOSE SESSION TASK
 */
// ask which task the user wants to work on
function askForSessionContent(convo) {
	var question = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var _convo$sessionStart5 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart5.SlackUserId;
	var tz = _convo$sessionStart5.tz;
	var content = _convo$sessionStart5.content;
	var minutes = _convo$sessionStart5.minutes;


	var sessionExample = (0, _messageHelpers.getRandomExample)("session");

	if (question == '') question = 'What would you like to set your current priority as? (i.e. `' + sessionExample + '`)';

	convo.ask({
		text: question
	}, [{
		pattern: _constants.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Okay! Let me know when you want to set your `/priority`');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;
			var _response$intentObjec = response.intentObject.entities;
			var reminder = _response$intentObjec.reminder;
			var duration = _response$intentObjec.duration;
			var datetime = _response$intentObjec.datetime;


			var content = (0, _messageHelpers.getSessionContentFromMessageObject)(response);

			if (content) {

				// optionally accept time here
				var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(response, tz);
				if (customTimeObject) {
					var now = (0, _momentTimezone2.default)().tz(tz);
					var _minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
					convo.sessionStart.minutes = _minutes;
					convo.next();
				}

				convo.sessionStart.content = content;
				finalizeSessionTimeAndContent(convo);
			} else {
				convo.say('I didn\'t get that :thinking_face:');
				convo.repeat();
			}
			convo.next();
		}
	}]);

	convo.next();
}

function askForSessionTime(convo) {
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$sessionStart6 = convo.sessionStart;
	var SlackUserId = _convo$sessionStart6.SlackUserId;
	var tz = _convo$sessionStart6.tz;
	var content = _convo$sessionStart6.content;
	var minutes = _convo$sessionStart6.minutes;

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
		pattern: _constants.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Okay, let me know when you\'re ready to focus!');
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
				var question = 'How much more time did you want to add to `' + content + '` today?';
				convo.repeat();
			}

			convo.next();
		}
	}]);

	convo.next();
}
//# sourceMappingURL=startSessionFunctions.js.map