'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.hears([_constants.THANK_YOU.reg_exp], 'direct_message', function (bot, message) {
		var SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			bot.reply(message, "You're welcome!! :smile:");
			(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
		}, 500);
	});

	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', _index.wit.hears, function (bot, message) {

		if (message.text && message.text[0] == "/") {
			// ignore all slash commands
			console.log("\n\n ~~ ignoring a slash command ~~ \n\n");
			return;
		}

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

				(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
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

			if (!user) {
				console.log('USER NOT FOUND: ' + SlackUserId);
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				if (!convo) {
					console.log("convo not working\n\n\n");
					return;
				}

				var name = user.nickName || user.email;
				convo.name = name;

				convo.onBoard = {
					SlackUserId: SlackUserId,
					postOnboardDecision: false
				};

				startOnBoardConversation(err, convo);

				convo.on('end', function (convo) {

					(0, _miscHelpers.consoleLog)("end of onboard for user!!!!", convo.onBoard);

					var _convo$onBoard = convo.onBoard;
					var SlackUserId = _convo$onBoard.SlackUserId;
					var nickName = _convo$onBoard.nickName;
					var timeZone = _convo$onBoard.timeZone;
					var postOnboardDecision = _convo$onBoard.postOnboardDecision;


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

					switch (postOnboardDecision) {
						case _intents2.default.START_DAY:
							controller.trigger('begin_day_flow', [bot, { SlackUserId: SlackUserId }]);
							break;
						default:
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
							break;
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
	askForUserName(err, convo);
}

function askForUserName(err, convo) {
	var name = convo.name;
	var bot = convo.task.bot;


	convo.ask({
		text: 'Before we begin, would you like me to call you *' + name + '* or another name?',
		attachments: [{
			text: "*_if you ever don’t want to click buttons, just type the button’s message and I’ll pick it up :nerd_face:_*",
			"mrkdwn_in": ["text"],
			attachment_type: 'default',
			callback_id: "ONBOARD",
			fallback: "What's your name?",
			color: _constants.colorsHash.blue.hex,
			actions: [{
				name: _constants.buttonValues.keepName.name,
				text: 'Keep my name!',
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
			convo.onBoard.nickName = name;
			convo.say('I really like the name *' + name + '*!');
			askForTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsKeep,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.onBoard.nickName = name;
			convo.say('Cool! I really like the name *' + name + '*!');
			askForTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.differentName.value,
		callback: function callback(response, convo) {
			askCustomUserName(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsDifferentOrAnother,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say("Okay!");
			askCustomUserName(response, convo);
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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
			convo.say('I really like the name *' + name + '*!');
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
	var bot = convo.task.bot;


	convo.ask({
		text: 'Which *timezone* are you in?',
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
			confirmTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.eastern,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.onBoard.timeZone = _constants.timeZones.eastern;
			confirmTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.timeZones.central.value,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.central;
			confirmTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.central,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.onBoard.timeZone = _constants.timeZones.central;
			confirmTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.timeZones.mountain.value,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.mountain;
			confirmTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.mountain,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.onBoard.timeZone = _constants.timeZones.mountain;
			confirmTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.timeZones.pacific.value,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.pacific;
			confirmTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.pacific,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.onBoard.timeZone = _constants.timeZones.pacific;
			confirmTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.timeZones.other.value,
		callback: function callback(response, convo) {
			askOtherTimeZoneOptions(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.other,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

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

	convo.say("As a time-based sidekick, I need to have your timezone to be effective");
	convo.say("Right now I only support the timezones listed above; I will let you know as soon as I support other ones");
	convo.say("If you're ever in a timezone I support, just say `settings` to update your timezone!");
	convo.onBoard.timeZone = _constants.timeZones.eastern;
	displayTokiOptions(response, convo);

	// convo.ask("What is your timezone?", (response, convo) => {

	// 	var timezone = response.text;
	// 	if (false) {
	// 		// functionality to try and get timezone here

	// 	} else {
	// 		convo.say("I'm so sorry, but I don't support your timezone yet for this beta phase, but I'll reach out when I'm ready to help you work");
	// 		convo.stop();
	// 	}

	// 	convo.next();

	// });

	convo.next();
}

function confirmTimeZone(response, convo) {
	var _convo$onBoard$timeZo = convo.onBoard.timeZone;
	var tz = _convo$onBoard$timeZo.tz;
	var name = _convo$onBoard$timeZo.name;
	var bot = convo.task.bot;


	convo.ask({
		text: 'I have you in the *' + name + '* timezone!',
		attachments: [{
			attachment_type: 'default',
			callback_id: "ONBOARD",
			fallback: "What's your timezone?",
			actions: [{
				name: _constants.buttonValues.thatsCorrect.name,
				text: 'That\'s correct :+1:',
				value: _constants.buttonValues.thatsCorrect.value,
				type: "button",
				style: "primary"
			}, {
				name: _constants.buttonValues.thatsIncorrect.name,
				text: 'No, that\'s not right!',
				value: _constants.buttonValues.thatsIncorrect.value,
				type: "button"
			}]
		}]
	}, [{
		pattern: _constants.buttonValues.thatsIncorrect.value,
		callback: function callback(response, convo) {
			askForTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Oops, okay!');
			askForTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _constants.buttonValues.thatsCorrect.value,
		callback: function callback(response, convo) {
			displayTokiOptions(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.yesOrCorrect,
		callback: function callback(response, convo) {

			console.log("\n\n\n ~~ said yes or correct ~~ \n\n\n");

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Fantastic!');
			displayTokiOptions(response, convo);
			convo.next();
		}
	}, { // everything else other than that's incorrect or "no" should be treated as yes
		default: true,
		callback: function callback(response, convo) {

			// delete button when answered with NL
			(0, _messageHelpers.deleteConvoAskMessage)(response.channel, bot);

			convo.say('Fantastic!');
			displayTokiOptions(response, convo);
			convo.next();
		}
	}]);
}

function displayTokiOptions(response, convo) {

	convo.say('You can change settings like your current timezone and name by telling me to `show settings`');
	convo.say({
		text: "As your personal sidekick, I can help you with your time by:",
		attachments: _constants.tokiOptionsAttachment
	});
	convo.say("I'll walk you through you how I can assist you to make the most of each day (but if you ever want to see all the things I can help you with, just say `show commands`!)");

	askUserToStartDay(response, convo);

	convo.next();
}

// end of convo, to start day
function askUserToStartDay(response, convo) {
	convo.ask("Please tell me to `start the day!` so we can plan our first day together :grin:", [{
		pattern: _botResponses.utterances.containsSettings,
		callback: function callback(response, convo) {
			convo.say("Okay, let's configure these settings again!");
			askForUserName(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsShowCommands,
		callback: function callback(response, convo) {
			showCommands(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsStartDay,
		callback: function callback(response, convo) {
			convo.say("Let's do this :grin:");
			convo.onBoard.postOnboardDecision = _intents2.default.START_DAY;
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			convo.say('Well, this is a bit embarrassing. Say `start the day` to keep moving forward so I can show you how I can help you work');
			convo.repeat();
			convo.next();
		}
	}]);
}

// show the more complex version of commands
function showCommands(response, convo) {

	convo.say({
		text: "I had a feeling you'd do that! Here are the different types of items you can tell me to help you with:",
		attachments: _constants.tokiOptionsExtendedAttachment
	});
	convo.say("The specific commands above, like `start my day` are guidelines - I'm able to understand other related commands, like `let's start the day` :smiley:");
	convo.say("I can also understand more complicated reminders, like `remind me to grab a glass of water in 5 min` to set a reminder to grab a glass of water for a time 5 minutes from now or `remind me to drink the glass of water at 9am` to set a reminder to grab drink the glass of water at 9am!");
	askUserToStartDay(response, convo);
	convo.next();
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