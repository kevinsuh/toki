'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *      ONBOARD FLOW
  */

	controller.on('begin_onboard_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

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
						case _constants.intentConfig.START_DAY:
							controller.trigger('new_plan_flow', [bot, { SlackUserId: SlackUserId }]);
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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function startOnBoardConversation(err, convo) {
	var name = convo.name;


	convo.say('Hey, ' + name + '! My name is Toki and I\'m your personal sidekick to win each day');
	askForUserName(err, convo);
}

function askForUserName(err, convo) {
	var name = convo.name;
	var bot = convo.task.bot;


	convo.ask({
		text: 'Before we begin, would you like me to call you *' + name + '* or another name?',
		attachments: [{
			text: "*_psst, if you don’t want to click buttons, type the button’s message and I’ll pick it up :nerd_face:_*",
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
		pattern: _botResponses.utterances.containsKeep,
		callback: function callback(response, convo) {
			convo.onBoard.nickName = name;
			askForTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.containsDifferentOrAnother,
		callback: function callback(response, convo) {
			convo.say("Okay!");
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

function askCustomUserName(response, convo) {

	convo.ask("What would you like me to call you?", function (response, convo) {
		convo.onBoard.nickName = response.text;
		askForTimeZone(response, convo);
		convo.next();
	});
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

function askForTimeZone(response, convo) {
	var nickName = convo.onBoard.nickName;
	var bot = convo.task.bot;


	convo.say({
		text: 'Nice to virtually meet you, ' + nickName + '! Here\'s how I help you win the day :trophy::',
		attachments: _constants.tokiOptionsAttachment
	});

	convo.ask({
		text: 'Since I help you make time for these outcomes, I need to know which *timezone* you are in!',
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
		pattern: _botResponses.utterances.eastern,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.eastern;
			startNewPlanFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.central,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.central;
			startNewPlanFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.mountain,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.mountain;
			startNewPlanFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.pacific,
		callback: function callback(response, convo) {
			convo.onBoard.timeZone = _constants.timeZones.pacific;
			startNewPlanFlow(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.other,
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

function startNewPlanFlow(response, convo) {
	var _convo$onBoard$timeZo = convo.onBoard.timeZone;
	var tz = _convo$onBoard$timeZo.tz;
	var name = _convo$onBoard$timeZo.name;


	convo.say('Awesome, I have you in the *' + name + '* timezone! Now let\'s win our first day together :grin:');
	convo.onBoard.postOnboardDecision = _constants.intentConfig.START_DAY;
	convo.next();
}

/**
 * 		Currently these functions are deprecated
 */
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
	var _convo$onBoard$timeZo2 = convo.onBoard.timeZone;
	var tz = _convo$onBoard$timeZo2.tz;
	var name = _convo$onBoard$timeZo2.name;
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
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say('Oops, okay!');
			askForTimeZone(response, convo);
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.yesOrCorrect,
		callback: function callback(response, convo) {
			convo.say("Fantastic! Let's get started with your first plan :grin:");
			convo.onBoard.postOnboardDecision = _constants.intentConfig.START_DAY;
			convo.next();
		}
	}, { // everything else other than that's incorrect or "no" should be treated as yes
		default: true,
		callback: function callback(response, convo) {
			convo.say("Fantastic! Let's get started with your first plan :grin:");
			convo.onBoard.postOnboardDecision = _constants.intentConfig.START_DAY;
			convo.next();
		}
	}]);
}

function displayTokiOptions(response, convo) {

	convo.say('You can always change your timezone and name by telling me to `show settings`');
	convo.say({
		text: "As your personal sidekick, I can help you with your time by:",
		attachments: _constants.tokiOptionsAttachment
	});
	convo.say("If you want to see how I specifically assist you to make the most of each day, just say `show commands`. Otherwise, let's move on!");
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
			convo.onBoard.postOnboardDecision = _constants.intentConfig.START_DAY;
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

	convo.say("I had a feeling you'd do that!");
	convo.say("First off, you can call me `hey toki!` at any point in the day and I'll be here to help you get in flow :raised_hands:");
	convo.say({
		text: "Here are more specific things you can tell me to help you with:",
		attachments: _constants.tokiOptionsExtendedAttachment
	});
	convo.say("I'm getting smart in understanding what you want, so the specific commands above are guidlines. I'm able to understand related commands :smile_cat:");
	convo.say("I also have two shortline commands that allow you to quickly add tasks `/add send email marketing report for 30 minutes` and quickly set reminders `/note grab a glass of water at 3:30pm`");
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