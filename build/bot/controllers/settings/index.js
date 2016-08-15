'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.hears(['settings'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;

		var config = { SlackUserId: SlackUserId };

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('settings_flow', [bot, config]);
		}, 550);
	});

	/**
  *      SETTINGS FLOW
  */

	controller.on('settings_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			user.SlackUser.getIncluded({
				include: [_models2.default.User]
			}).then(function (includedSlackUsers) {

				console.log('\n\n included slack users: \n\n');
				console.log(includedSlackUsers);

				var nickName = user.nickName;
				var defaultSnoozeTime = user.defaultSnoozeTime;
				var defaultBreakTime = user.defaultBreakTime;
				var wantsPing = user.wantsPing;
				var pingTime = user.pingTime;
				var includeOthersDecision = user.includeOthersDecision;
				var tz = user.SlackUser.tz;

				var userTimeZone = {};
				for (var key in _constants.timeZones) {
					if (_constants.timeZones[key].tz == tz) {
						userTimeZone = _constants.timeZones[key];
					}
				}

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					var name = user.nickName || user.email;
					convo.name = name;

					convo.settings = {
						SlackUserId: SlackUserId,
						timeZone: userTimeZone,
						nickName: name,
						defaultBreakTime: defaultBreakTime,
						defaultSnoozeTime: defaultSnoozeTime,
						wantsPing: wantsPing,
						pingTime: pingTime,
						includeOthersDecision: includeOthersDecision,
						includedSlackUsers: includedSlackUsers
					};

					convo.say('Hello, ' + name + '!');
					settingsHome(convo);
					convo.next();

					convo.on('end', function (convo) {

						(0, _miscHelpers.consoleLog)("end of settings for user!!!!", convo.settings);

						var _convo$settings = convo.settings;
						var SlackUserId = _convo$settings.SlackUserId;
						var nickName = _convo$settings.nickName;
						var timeZone = _convo$settings.timeZone;
						var defaultBreakTime = _convo$settings.defaultBreakTime;
						var defaultSnoozeTime = _convo$settings.defaultSnoozeTime;

						// if (timeZone) {
						// 	const { tz } = timeZone;
						// 	user.SlackUser.update({
						// 		tz
						// 	});
						// }

						// if (nickName) {
						// 	user.update({
						// 		nickName
						// 	});
						// }

						// if (defaultSnoozeTime) {
						// 	user.update({
						// 		defaultSnoozeTime
						// 	})
						// }

						// if (defaultBreakTime) {
						// 	user.update({
						// 		defaultBreakTime
						// 	})
						// }

						(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
					});
				});
			});
		});
	});
};

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
	var _convo$settings2 = convo.settings;
	var timeZone = _convo$settings2.timeZone;
	var nickName = _convo$settings2.nickName;
	var defaultSnoozeTime = _convo$settings2.defaultSnoozeTime;
	var defaultBreakTime = _convo$settings2.defaultBreakTime;
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

// user wants to update settings!


function askWhichSettingsToUpdate(convo) {
	var text = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];
	var settings = convo.settings;
	var _convo$settings3 = convo.settings;
	var timeZone = _convo$settings3.timeZone;
	var nickName = _convo$settings3.nickName;
	var defaultSnoozeTime = _convo$settings3.defaultSnoozeTime;
	var defaultBreakTime = _convo$settings3.defaultBreakTime;
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
			convo.say('CHANGING PING');
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

			convo.say('Phew :sweat_smile: I really like the name ' + nickName);
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
	var timeZone = convo.settings.timeZone;


	convo.ask({
		text: 'I have you in the *' + timeZone.name + '* timezone. What timezone are you in now?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "ONBOARD",
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
				settingsHome(convo);
			} else {
				convo.say("I didn't get that :thinking_face:");
				convo.repeat();
			}

			convo.next();
		}
	}]);
}
//# sourceMappingURL=index.js.map