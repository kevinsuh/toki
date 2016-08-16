'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// TOKI_T1ME TESTER
	controller.hears(['TOKI_T1ME'], 'direct_message', function (bot, message) {
		var text = message.text;

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			var HEY_LISTEN = new RegExp(/\bHEY_LISTEN\b/);
			var GYRADOS = new RegExp(/\bGYRADOS\b/);

			if (HEY_LISTEN.test(text)) {
				if (GYRADOS.test(text)) {
					controller.trigger('gyrados_message_flow', [bot, { SlackUserId: SlackUserId }]);
				} else {
					controller.trigger('global_message_flow', [bot, { SlackUserId: SlackUserId }]);
				}
			} else {
				controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
			}
		}, 1000);
	});
	var beginAdventure = new RegExp(/\bbegin adventure\b/i);
	controller.hears([beginAdventure], 'direct_message', function (bot, message) {

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
		}, 750);
	});

	// intentionally pausing session
	controller.hears(['pa[ause]{1,}'], 'direct_message', function (bot, message) {

		var SlackUserId = message.user;

		var text = message.text;
		var _message$intentObject = message.intentObject.entities;
		var reminder = _message$intentObject.reminder;
		var datetime = _message$intentObject.datetime;
		var duration = _message$intentObject.duration;


		var valid = true;

		// these are different scenarios where a pause NL functionality is highly unlikely
		if (datetime || duration) {
			valid = false;
		} else if (text.length > 25) {
			valid = false;
		} else if (text[0] == "/") {
			valid = false;
		}

		if (valid) {
			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(function () {

				var config = { SlackUserId: SlackUserId };
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("Okay, let's pause!");
					convo.next();
					convo.on('end', function (convo) {
						controller.trigger('session_pause_flow', [bot, config]);
					});
				});
			}, 1000);
		}
	});

	// intentionally resuming session
	controller.hears(['re[esume]{3,}'], 'direct_message', function (bot, message) {

		var SlackUserId = message.user;

		var text = message.text;
		var _message$intentObject2 = message.intentObject.entities;
		var reminder = _message$intentObject2.reminder;
		var datetime = _message$intentObject2.datetime;
		var duration = _message$intentObject2.duration;


		var valid = true;

		// these are different scenarios where a pause NL functionality is highly unlikely
		if (datetime || duration) {
			valid = false;
		} else if (text.length > 25) {
			valid = false;
		} else if (text[0] == "/") {
			valid = false;
		}

		if (valid) {
			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(function () {

				var config = { SlackUserId: SlackUserId };
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("Okay, let's resume :arrow_forward:");
					convo.next();
					convo.on('end', function (convo) {
						controller.trigger('session_resume_flow', [bot, config]);
					});
				});
			}, 1000);
		}
	});

	controller.on('global_message_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		// IncluderSlackUserId is the one who's actually using Toki

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var email = user.email;
			var nickName = user.nickName;
			var tz = user.SlackUser.tz;

			var adminEmails = ['kevinsuh34@gmail.com', 'chipkoziara@gmail.com', 'kevin_suh34@yahoo.com', 'ch.ipkoziara@gmail.com', 'TEMPEMAILHOLDERCTILecXhPL@gmail.com'];

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				convo.globalMessage = {
					text: false
				};

				if (adminEmails.indexOf(email) > -1) {
					askWhichMessageToSend(convo);
				} else {
					convo.say('You are not authorized to send a global message :rage:');
				}

				convo.on('end', function (convo) {
					var globalMessage = convo.globalMessage;


					if (globalMessage.text) {

						sendGlobalMessage(globalMessage.text);
					}
				});
			});
		});
	});

	// THIS IS THE MESSAGE OVERWRITING EVERYONE ONTO THE NEW FLOW
	controller.on('gyrados_message_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		// IncluderSlackUserId is the one who's actually using Toki

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var email = user.email;
			var nickName = user.nickName;
			var tz = user.SlackUser.tz;

			var adminEmails = ['kevinsuh34@gmail.com', 'chipkoziara@gmail.com', 'kevin_suh34@yahoo.com', 'ch.ipkoziara@gmail.com', 'TEMPEMAILHOLDERCTILecXhPL@gmail.com'];

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				convo.globalMessage = {
					text: false
				};

				if (adminEmails.indexOf(email) > -1) {
					confirmGyradosMessage(convo);
				} else {
					convo.say('You are not authorized to send this gyrados message message :rage:');
				}

				convo.on('end', function (convo) {
					var confirmSendGyradosMessage = convo.confirmSendGyradosMessage;


					if (confirmSendGyradosMessage) {

						sendGyradosMessage(controller);
					}
				});
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _miscHelpers = require('../../lib/miscHelpers');

var _messageHelpers = require('../../lib/messageHelpers');

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function askWhichMessageToSend(convo) {

	convo.say('Welcome to *_hey listen_*! The message you send here will get sent to every user who I have in my database, through me. Please don\'t make me look bad :wink:');
	convo.ask('What is the message you want to send?', [{
		pattern: _botResponses.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Got it! Exiting now. :wave:');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			confirmMessageToSend(response, convo);
			convo.next();
		}
	}]);
}

/**
 * 		Sometimes there is a need for just NL functionality not related
 * 		to Wit and Wit intents. Put those instances here, since they will
 * 		show up before Wit gets a chance to pick them up first.
 */

function confirmMessageToSend(response, convo) {
	var text = response.text;

	convo.say(text);
	convo.ask('Is that the message you want to send above?', [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.globalMessage.text = text;
			convo.say('Got it! Sending now. . . . :robot_face: ');
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Okay! If you want to exit, say `never mind`");
			askWhichMessageToSend(convo);
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

function confirmGyradosMessage(convo) {

	convo.say('Good morning! I\'ve received an update that changes the way I work with you\nNow I help you *define and accomplish the 3 most important outcomes each day*');
	convo.say('This is a big change, but as Benjamin Franklin said:\n> _"Without continual growth and progress, such words as improvement, achievement, and success have no meaning.”_​');
	convo.say({
		text: 'Thank you for being an early user :heart_eyes: I’m excited to help you win your day :muscle:',
		attachments: [{
			attachment_type: 'default',
			callback_id: "CONFIRM_NEW_TOKI",
			fallback: "Ready to start our new adventure?",
			color: _constants.colorsHash.green.hex,
			actions: [{
				name: _constants.buttonValues.letsWinTheDay.name,
				text: ":running:Begin adventure:running:",
				value: _constants.buttonValues.letsWinTheDay.value,
				type: "button"
			}]
		}]
	});

	convo.ask('Is that the message you want to send above?', [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.confirmSendGyradosMessage = true;
			convo.say('Got it! Sending now. . . . :robot_face: ');
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Okay! Exiting out of gyrados flow now");
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
	convo.next();
}

function sendGyradosMessage(controller) {

	var env = process.env.NODE_ENV || 'development';
	if (env == 'development') {
		console.log("In development server of Toki");
		process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
	} else {
		console.log('currently in ' + env + ' environment');
	}

	var _loop = function _loop(token) {

		var bot = _index.bots[token];
		var TeamId = bot.team_info.id;

		_models2.default.User.findAll({
			where: ['"SlackUser"."TeamId" = ?', TeamId],
			include: [_models2.default.SlackUser]
		}).then(function (users) {

			users.forEach(function (user) {
				var email = user.email;
				var SlackUserId = user.SlackUser.SlackUserId;


				console.log(email);

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					if (!err) {

						convo.say('Good morning! I\'ve received an update that changes the way I work with you\nNow I help you *define and accomplish the 3 most important outcomes each day*');
						convo.say('This is a big change, but as Benjamin Franklin said:\n> _"Without continual growth and progress, such words as improvement, achievement, and success have no meaning.”_​');
						convo.ask({
							text: 'Thank you for being an early user :heart_eyes: I’m excited to help you win your day :muscle:',
							attachments: [{
								attachment_type: 'default',
								callback_id: "CONFIRM_NEW_TOKI",
								fallback: "Ready to start our new adventure?",
								color: _constants.colorsHash.green.hex,
								actions: [{
									name: "BEGIN_ADVENTURE",
									text: ":running:Begin adventure:running:",
									value: "begin adventure",
									type: "button"
								}]
							}]
						}, [{
							pattern: _botResponses.utterances.beginAdventure,
							callback: function callback(response, convo) {
								convo.confirmBeginAdventure = true;
								convo.say('*_Here... we... go!!!_* :rocket:');
								convo.next();
							}
						}, {
							default: true,
							callback: function callback(response, convo) {
								convo.say("Sorry, I didn't catch that!");
								convo.repeat();
								convo.next();
							}
						}]);

						convo.on('end', function (convo) {
							var confirmBeginAdventure = convo.confirmBeginAdventure;

							if (confirmBeginAdventure) {
								controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
							}
						});
					}
				});
			});
		});
	};

	for (var token in _index.bots) {
		_loop(token);
	}
}

// sends message to all of the users in our DB!
function sendGlobalMessage(text) {

	var env = process.env.NODE_ENV || 'development';
	if (env == 'development') {
		console.log("In development server of Toki");
		process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
	} else {
		console.log('currently in ' + env + ' environment');
	}

	var _loop2 = function _loop2(token) {

		var bot = _index.bots[token];
		var TeamId = bot.team_info.id;

		_models2.default.User.findAll({
			where: ['"SlackUser"."TeamId" = ?', TeamId],
			include: [_models2.default.SlackUser]
		}).then(function (users) {

			users.forEach(function (user) {
				var email = user.email;
				var SlackUserId = user.SlackUser.SlackUserId;

				console.log(email);
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					if (!err) {
						// some users are disabled and this will not send to them
						convo.say(text);
					}
				});
			});
		});
	};

	for (var token in _index.bots) {
		_loop2(token);
	}
}
//# sourceMappingURL=index.js.map