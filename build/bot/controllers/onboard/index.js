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


	convo.say('Hey, ' + name + '! My name is Toki and I\'m here to help you win each day by accomplishing your top 3 priorities');
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
			explainTokiBenefits(convo);
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
		explainTokiBenefits(convo);
		convo.next();
	});
}

function confirmUserName(name, convo) {

	convo.ask('So you\'d like me to call you *' + name + '*?', [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.onBoard.nickName = name;
			explainTokiBenefits(convo);
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

function explainTokiBenefits(convo) {
	var nickName = convo.onBoard.nickName;
	var bot = convo.task.bot;


	var text = 'Nice to virtually meet you, ' + nickName + '!';
	convo.say(text);
	text = ':trophy: Here\'s how I help you win each day :trophy:';
	var attachments = [{
		text: 'Instead of treating each day as a never-ending list of todos, I’m here to help you identify the *top 3 priorities* that actually define your day, *_and accomplish them_*',
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		"mrkdwn_in": ["text"],
		color: _constants.colorsHash.salmon.hex,
		actions: [{
			name: _constants.buttonValues.next.name,
			text: "Why three?",
			value: _constants.buttonValues.next.value,
			type: "button"
		}]
	}];

	convo.ask({
		text: text,
		attachments: attachments
	}, function (response, convo) {

		attachments[0].text = 'I realize you’ll likely be working on more than three tasks each day. My purpose isn’t to help you get a huge list of things done. I’m here to make sure you get *3 higher level priorities done that are critically important to your day, but might get lost or pushed back* if you don’t deliberately make time for them';
		attachments[0].actions[0].text = 'What else?';
		attachments[0].color = _constants.colorsHash.blue.hex;

		convo.ask({
			attachments: attachments
		}, function (response, convo) {

			attachments[0].text = 'I can also send your priorities to anyone on your team if you’d like to ​*share what you’re working on*';
			attachments[0].actions[0].text = 'Let\'s do this!';
			attachments[0].color = _constants.colorsHash.yellow.hex;

			convo.ask({
				attachments: attachments
			}, function (response, convo) {

				askForTimeZone(response, convo);
				convo.next();
			});

			convo.next();
		});

		convo.next();
	});
}

function askForTimeZone(response, convo) {
	var nickName = convo.onBoard.nickName;
	var bot = convo.task.bot;


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

function askOtherTimeZoneOptions(response, convo) {

	convo.say("As a time-based sidekick, I need to have your timezone to be effective");
	convo.say("I’m only able to work in these timezones right now. If you want to demo Toki, just pick one of these timezones. I’ll try to get your timezone included as soon as possible!");
	askForTimeZone(response, convo);
	convo.next();
}

function startNewPlanFlow(response, convo) {
	var _convo$onBoard$timeZo = convo.onBoard.timeZone;
	var tz = _convo$onBoard$timeZo.tz;
	var name = _convo$onBoard$timeZo.name;


	convo.say('Awesome, I have you in the *' + name + '* timezone! Now let\'s win the day :grin:');
	convo.onBoard.postOnboardDecision = _constants.intentConfig.START_DAY;
	convo.next();
}
//# sourceMappingURL=index.js.map