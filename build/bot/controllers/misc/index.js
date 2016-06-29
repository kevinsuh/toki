'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {
	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;

		(0, _miscHelpers.consoleLog)("in back up area!!!", message);

		var SECRET_KEY = new RegExp(/^TOKI_T1ME/);

		// user said something outside of wit's scope
		if (!message.selectedIntent) {

			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(function () {

				// different fallbacks based on reg exp
				var text = message.text;


				if (_constants.THANK_YOU.reg_exp.test(text)) {
					// user says thank you
					bot.reply(message, "You're welcome!! :smile:");
				} else if (SECRET_KEY.test(text)) {

					(0, _miscHelpers.consoleLog)("UNLOCKED TOKI_T1ME!!!");
					/*
     		
     *** ~~ TOP SECRET PASSWORD FOR TESTING FLOWS ~~ ***
     		
      */
					controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
				} else {
					// end-all fallback
					var options = [{ title: 'start a day', description: 'get started on your day' }, { title: 'start a session', description: 'start a work session with me' }, { title: 'end session early', description: 'end your current work session with me' }];
					var colorsArrayLength = _constants.colorsArray.length;
					var optionsAttachment = options.map(function (option, index) {
						var colorsArrayIndex = index % colorsArrayLength;
						return {
							fields: [{
								title: option.title,
								value: option.description
							}],
							color: _constants.colorsArray[colorsArrayIndex].hex,
							attachment_type: 'default',
							callback_id: "SHOW OPTIONS",
							fallback: option.description
						};
					});

					bot.reply(message, {
						text: "Hey! I can only help you with a few things. Here's the list of things I can help you with:",
						attachments: optionsAttachment
					});
				}
			}, 1000);
		}
	});

	/**
  *      ONBOARD FLOW
  */

	controller.on('begin_onboard_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				var name = user.nickName || user.email;
				convo.name = name;

				convo.onBoard = {
					SlackUserId: SlackUserId
				};

				startOnBoardConversation(err, convo);

				convo.on('end', function (convo) {

					(0, _miscHelpers.consoleLog)("in back up area!!!", convo.onBoard);

					var _convo$onBoard = convo.onBoard;
					var SlackUserId = _convo$onBoard.SlackUserId;
					var nickName = _convo$onBoard.nickName;
					var timeZone = _convo$onBoard.timeZone;


					if (timeZone) {
						var tz = timeZone.tz;


						user.SlackUser.update({
							tz: tz
						});
					}

					if (nickName) {

						user.update({
							nickName: nickName
						});
					}
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

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function startOnBoardConversation(err, convo) {
	var name = convo.name;


	convo.say('Hey ' + name + '! Thanks for inviting me to help you make the most of your time each day');
	convo.say("Before I explain how I work, let's make sure I have two crucial details: your name and your timezone!");
	askForUserName(err, convo);
}

function askForUserName(err, convo) {
	var name = convo.name;


	convo.ask({
		text: 'Would you like me to call you ' + name + ' or another name?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "ONBOARD",
			fallback: "What's your name?",
			color: _constants.colorsHash.blue.hex,
			actions: [{
				name: _constants.buttonValues.keepName.name,
				text: 'Call me ' + name + '!',
				value: _constants.buttonValues.keepName.value,
				type: "button"
			}, {
				name: _constants.buttonValues.differentName.name,
				text: 'Another name',
				value: _constants.buttonValues.differentName.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.keepName.value,
		callback: function callback(response, convo) {
			confirmUserName(name, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.differentName.value,
		callback: function callback(response, convo) {
			askCustomUserName(response, convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			confirmUserName(response.text, convo);
			convo.next();
		}
	}]);
}

function confirmUserName(name, convo) {

	convo.ask('So you\'d like me to call you *' + name + '*?', [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.onBoard.nickName = name;
			askForTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			askCustomUserName(response, convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			convo.say("Sorry, I didn't get that :thinking_face:");
			convo.repeat();
			convo.next();
		}
	}]);
}

function askCustomUserName(response, convo) {

	convo.ask("What would you like me to call you?", function (response, convo) {
		confirmUserName(response.text, convo);
		convo.next();
	});
}

function askForTimeZone(response, convo) {
	var nickName = convo.onBoard.nickName;


	convo.say('I really like the name *' + nickName + '*!');
	convo.ask({
		text: 'Now which *timezone* are you in?',
		attachments: [{
			attachment_type: 'default',
			callback_id: "ONBOARD",
			fallback: "What's your timezone?",
			color: _constants.colorsHash.blue.hex,
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
		pattern: _constants.buttonValues.timeZones.eastern.value,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.eastern;
			displayTokiOptions(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.timeZones.central.value,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.central;
			displayTokiOptions(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.timeZones.mountain.value,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.mountain;
			displayTokiOptions(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.timeZones.pacific.value,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.pacific;
			displayTokiOptions(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.timeZones.other.value,
		callback: function callback(response, convo) {
			askOtherTimeZoneOptions(response, convo);
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

// for now we do not provide this
function askOtherTimeZoneOptions(response, convo) {

	convo.say("As Toki the Time Fairy, I need to get this right :grin:");
	convo.ask("What is your timezone?", function (response, convo) {

		var timezone = response.text;
		if (false) {
			// functionality to try and get timezone here

		} else {
			convo.say("I'm so sorry, but I don't support your timezone yet for this beta phase, but I'll reach out when I'm ready to help you work");
			convo.stop();
		}

		convo.next();
	});

	convo.next();
}

function confirmTimeZone(response, convo) {}

function displayTokiOptions(response, convo) {
	var _convo$onBoard$timeZo = convo.onBoard.timeZone;
	var tz = _convo$onBoard$timeZo.tz;
	var name = _convo$onBoard$timeZo.name;


	convo.say('I now have you in *' + name + '* timezone. You can change settings like your current timezone and name by telling me to `show settings`');
	convo.say({
		text: "As your personal sidekick, I can help you with your time by:",
		attachments: _constants.tokiOptionsAttachment
	});
	convo.say("The specific commands above, like `start my day` are guidelines - I'm able to understand other related commands");
	convo.say("Tell me `let's start the day, Toki!` or something like that to see this in action :grin:");
	convo.next();

	// END OF CONVERSATION
}

function TEMPLATE_FOR_TEST(bot, message) {

	var SlackUserId = message.user;

	_models2.default.User.find({
		where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
		include: [_models2.default.SlackUser]
	}).then(function (user) {

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			var name = user.nickName || user.email;

			// on finish convo
			convo.on('end', function (convo) {});
		});
	});
}
//# sourceMappingURL=index.js.map