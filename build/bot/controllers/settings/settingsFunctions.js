'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.settingsHome = settingsHome;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// the home view of user's settings
function settingsHome(convo) {
	var settings = convo.settings;
	var _convo$settings = convo.settings;
	var timeZone = _convo$settings.timeZone;
	var nickName = _convo$settings.nickName;
	var defaultSnoozeTime = _convo$settings.defaultSnoozeTime;
	var defaultBreakTime = _convo$settings.defaultBreakTime;
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;


	var text = 'Here are your settings:';
	var attachments = (0, _messageHelpers.getSettingsAttachment)(settings);
	convo.say({
		text: text,
		attachments: attachments
	});

	askWhichSettingsToUpdate(convo);
}

function askWhichSettingsToUpdate(convo) {
	var text = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];
	var settings = convo.settings;
	var _convo$settings2 = convo.settings;
	var timeZone = _convo$settings2.timeZone;
	var nickName = _convo$settings2.nickName;
	var defaultSnoozeTime = _convo$settings2.defaultSnoozeTime;
	var defaultBreakTime = _convo$settings2.defaultBreakTime;
	var task = convo.task;
	var bot = task.bot;
	var source_message = task.source_message;


	if (!text) text = 'Which of these settings would you like me to update?';

	convo.ask({
		text: text,
		attachments: [{
			callback_id: "UPDATE_SETTINGS",
			fallback: 'Would you like to update a settings?',
			color: _constants.colorsHash.grey.hex,
			attachment_type: 'default',
			actions: [{
				name: _constants.buttonValues.neverMind.name,
				text: "Good for now!",
				value: _constants.buttonValues.neverMind.value,
				type: "button"
			}]
		}]
	}, [{ // change name
		pattern: _botResponses.utterances.containsName,
		callback: function callback(response, convo) {
			convo.say('Sure thing!');
			changeName(convo);
			convo.next();
		}
	}, { // change timeZone
		pattern: _botResponses.utterances.containsTimeZone,
		callback: function callback(response, convo) {
			changeTimeZone(convo);
			convo.next();
		}
	}, { // change morning ping
		pattern: _botResponses.utterances.containsPing,
		callback: function callback(response, convo) {
			changeMorningPing(convo);
			convo.next();
		}
	}, { // change extend duration
		pattern: _botResponses.utterances.containsExtend,
		callback: function callback(response, convo) {
			convo.say('CHANGING EXTEND');
			convo.next();
		}
	}, { // change break duration
		pattern: _botResponses.utterances.containsBreak,
		callback: function callback(response, convo) {
			convo.say('CHANGING BREAK');
			convo.next();
		}
	}, { // change priority sharing
		pattern: _botResponses.utterances.containsPriority,
		callback: function callback(response, convo) {
			convo.say('CHANGING PRIORITY');
			convo.next();
		}
	}, {
		// no or never mind to exit this flow
		pattern: _botResponses.utterances.containsNoOrNeverMindOrNothing,
		callback: function callback(response, convo) {
			convo.say('Okay! Let me know whenever you want to `edit settings`');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = "Sorry, I didn't get that. Which specific settings would you like to update? `i.e. morning ping`";
			askWhichSettingsToUpdate(convo, text);
			convo.next();
		}
	}]);
}

// user wants to change name
function changeName(convo) {
	var nickName = convo.settings.nickName;


	convo.ask({
		text: "What would you like me to call you?",
		attachments: [{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_NAME",
			fallback: "What would you like me to call you?",
			actions: [{
				name: _constants.buttonValues.keepName.name,
				text: 'Keep my name!',
				value: _constants.buttonValues.keepName.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.containsKeep,
		callback: function callback(response, convo) {

			convo.say('Phew :sweat_smile: I really like the name ' + nickName + ' so I\'m glad you kept it');
			settingsHome(convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			nickName = response.text;
			convo.settings.nickName = nickName;
			convo.say('Ooh I like the name ' + nickName + '! It has a nice ring to it');
			settingsHome(convo);
			convo.next();
		}
	}]);
}

// user wants to change timezone
function changeTimeZone(convo) {
	var _convo$settings3 = convo.settings;
	var SlackUserId = _convo$settings3.SlackUserId;
	var timeZone = _convo$settings3.timeZone;


	convo.ask({
		text: 'I have you in the *' + timeZone.name + '* timezone. What timezone are you in now?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "SETTINGS_CHANGE_TIMEZONE",
			fallback: "What's your timezone?",
			color: _constants.colorsHash.grey.hex,
			actions: [{
				name: _constants.buttonValues.timeZones.eastern.name,
				text: 'Eastern',
				value: _constants.buttonValues.timeZones.eastern.value,
				type: "button"
			}, {
				name: _constants.buttonValues.timeZones.central.name,
				text: 'Central',
				value: _constants.buttonValues.timeZones.central.value,
				type: "button"
			}, {
				name: _constants.buttonValues.timeZones.mountain.name,
				text: 'Mountain',
				value: _constants.buttonValues.timeZones.mountain.value,
				type: "button"
			}, {
				name: _constants.buttonValues.timeZones.pacific.name,
				text: 'Pacific',
				value: _constants.buttonValues.timeZones.pacific.value,
				type: "button"
			}, {
				name: _constants.buttonValues.timeZones.other.name,
				text: 'Other',
				value: _constants.buttonValues.timeZones.other.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _botResponses.utterances.other,
		callback: function callback(response, convo) {
			convo.say("I’m only able to work in these timezones right now. If you want to demo Toki, just pick one of these timezones. I’ll try to get your timezone included as soon as possible!");
			convo.repeat();
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			var newTimeZone = false;

			switch (text) {
				case (text.match(_botResponses.utterances.eastern) || {}).input:
					newTimeZone = _constants.timeZones.eastern;
					break;
				case (text.match(_botResponses.utterances.central) || {}).input:
					newTimeZone = _constants.timeZones.central;
					break;
				case (text.match(_botResponses.utterances.mountain) || {}).input:
					newTimeZone = _constants.timeZones.mountain;
					break;
				case (text.match(_botResponses.utterances.pacific) || {}).input:
					newTimeZone = _constants.timeZones.pacific;
				default:
					break;
			}

			if (newTimeZone) {
				convo.settings.timeZone = newTimeZone;

				// update it here because morningPing might depend on changed timezone
				var _newTimeZone = newTimeZone;
				var tz = _newTimeZone.tz;

				_models2.default.SlackUser.update({
					tz: tz
				}, {
					where: ['"SlackUserId" = ?', SlackUserId]
				});
				settingsHome(convo);
			} else {
				convo.say("I didn't get that :thinking_face:");
				convo.repeat();
			}

			convo.next();
		}
	}]);
}

// user wants to change morning ping
function changeMorningPing(convo) {
	var _convo$settings4 = convo.settings;
	var timeZone = _convo$settings4.timeZone;
	var wantsPing = _convo$settings4.wantsPing;
	var pingTime = _convo$settings4.pingTime;


	if (pingTime) {
		if (wantsPing) {
			// has ping right now and probably wants to disable
			editLivePingTime(convo);
		} else {
			// has ping time that is disabled, so can enable
			editDisabledPingTime(convo);
		}
	} else {
		// no existing ping time!
		setNewPingTime(convo);
	}
}

// live ping time ethat exists
function editLivePingTime(convo) {
	var _convo$settings5 = convo.settings;
	var timeZone = _convo$settings5.timeZone;
	var wantsPing = _convo$settings5.wantsPing;
	var pingTime = _convo$settings5.pingTime;

	var currentPingTimeObject = (0, _momentTimezone2.default)(pingTime).tz(timeZone.tz);
	var currentPingTimeString = currentPingTimeObject.format("h:mm a");

	var text = 'Your Morning Ping is set to ' + currentPingTimeString + ' and it’s currently *enabled* so you are receiving a greeting each weekday morning to make a plan to win your day :medal:';
	var attachments = [{
		attachment_type: 'default',
		callback_id: "SETTINGS_CHANGE_MORNING_PING",
		fallback: "When do you want a morning ping?",
		color: _constants.colorsHash.grey.hex,
		actions: [{
			name: _constants.buttonValues.changeTime.name,
			text: 'Change Time :clock7:',
			value: _constants.buttonValues.changeTime.value,
			type: "button"
		}, {
			name: _constants.buttonValues.disable.name,
			text: 'Disable',
			value: _constants.buttonValues.disable.value,
			type: "button"
		}, {
			name: _constants.buttonValues.no.name,
			text: 'Never Mind',
			value: _constants.buttonValues.no.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: text,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.containsChange,
		callback: function callback(response, convo) {

			convo.settings.wantsPing = true;
			changePingTime(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsDisable,
		callback: function callback(response, convo) {

			convo.settings.wantsPing = false;
			convo.say('Consider it done (because it is done :stuck_out_tongue_winking_eye:). You are no longer receiving morning pings each weekday');
			settingsHome(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Okay!');
			settingsHome(convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			convo.say("I didn't get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

// disabled ping time that exists
function editDisabledPingTime(convo) {
	var _convo$settings6 = convo.settings;
	var timeZone = _convo$settings6.timeZone;
	var wantsPing = _convo$settings6.wantsPing;
	var pingTime = _convo$settings6.pingTime;

	var currentPingTimeObject = (0, _momentTimezone2.default)(pingTime).tz(timeZone.tz);
	var currentPingTimeString = currentPingTimeObject.format("h:mm a");

	var text = 'Your Morning Ping is set to ' + currentPingTimeString + ' but it’s currently *disabled* so you’re not receiving a greeting each weekday morning to make a plan to win your day';
	var attachments = [{
		attachment_type: 'default',
		callback_id: "SETTINGS_CHANGE_MORNING_PING",
		fallback: "When do you want a morning ping?",
		color: _constants.colorsHash.grey.hex,
		actions: [{
			name: _constants.buttonValues.keepTime.name,
			text: 'Enable + Keep Time',
			value: _constants.buttonValues.keepTime.value,
			type: "button"
		}, {
			name: _constants.buttonValues.changeTime.name,
			text: 'Enable + Change Time',
			value: _constants.buttonValues.changeTime.value,
			type: "button"
		}, {
			name: _constants.buttonValues.no.name,
			text: 'Never Mind',
			value: _constants.buttonValues.no.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: text,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.containsChange,
		callback: function callback(response, convo) {

			convo.settings.wantsPing = true;
			convo.say('I love how you’re getting after it :raised_hands:');
			changePingTime(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsKeep,
		callback: function callback(response, convo) {

			convo.settings.wantsPing = true;
			convo.say('Got it! I’ll ping you at ' + currentPingTimeString + ' to make a plan to win your day :world_map:');
			settingsHome(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Okay!');
			settingsHome(convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			convo.say("I didn't get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

// ping time for the first time!
function setNewPingTime(convo) {
	var _convo$settings7 = convo.settings;
	var timeZone = _convo$settings7.timeZone;
	var wantsPing = _convo$settings7.wantsPing;
	var pingTime = _convo$settings7.pingTime;


	var text = 'Would you like me to reach out each weekday morning to encourage you to make a plan to  achieve your most important outcomes?';
	var attachments = [{
		attachment_type: 'default',
		callback_id: "SETTINGS_CHANGE_MORNING_PING",
		fallback: "When do you want a morning ping?",
		color: _constants.colorsHash.grey.hex,
		actions: [{
			name: _constants.buttonValues.yes.name,
			text: 'Yes!',
			value: _constants.buttonValues.yes.value,
			type: "button"
		}, {
			name: _constants.buttonValues.no.name,
			text: 'Not right now',
			value: _constants.buttonValues.no.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: text,
		attachments: attachments
	}, [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {

			convo.settings.wantsPing = true;
			convo.say('I love how you’re getting after it :raised_hands:');
			changePingTime(convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say('Okay!');
			settingsHome(convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			convo.say("I didn't get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

// ask to change the ping time!
function changePingTime(convo) {
	var _convo$settings8 = convo.settings;
	var timeZone = _convo$settings8.timeZone;
	var wantsPing = _convo$settings8.wantsPing;
	var pingTime = _convo$settings8.pingTime;


	convo.ask('What time would you like me to reach out?', function (response, convo) {
		var datetime = response.intentObject.entities.datetime;

		var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, timeZone.tz);
		var now = (0, _momentTimezone2.default)();

		if (customTimeObject && datetime) {

			// datetime success!
			convo.settings.pingTime = customTimeObject;
			var timeString = customTimeObject.format("h:mm a");
			convo.say('Got it! I’ll ping you at ' + timeString + ' to make a plan to win your day :world_map:');
			convo.say('I hope you have a great rest of the day!');
			settingsHome(convo);
			convo.next();
		} else {
			convo.say("Sorry, I didn't get that :thinking_face: let me know a time like `8:30am`");
			convo.repeat();
		}
		convo.next();
	});
}
//# sourceMappingURL=settingsFunctions.js.map