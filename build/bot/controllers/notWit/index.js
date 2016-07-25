'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

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
					convo.say("Okay, let's pause your session");
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
					convo.say("Okay, let's resume your session :arrow_forward:");
					convo.next();
					convo.on('end', function (convo) {
						controller.trigger('session_resume_flow', [bot, config]);
					});
				});
			}, 1000);
		}
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

var _miscHelpers = require('../../lib/miscHelpers');

var _messageHelpers = require('../../lib/messageHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map