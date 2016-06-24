'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _pg = require('pg');

var _pg2 = _interopRequireDefault(_pg);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _server = require('../../../server');

var _controllers = require('../../../bot/controllers');

var _slackApiHelpers = require('../../../bot/lib/slackApiHelpers');

var _models = require('../../models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

/**
 *    SLACK RECEIVES CONTROLLER
 *    `/api/v1/slack_receive`
 */

// index
router.get('/', function (req, res) {

	res.json({ "hello": "world" });
});

// create
router.post('/', function (req, res) {

	console.log("\n\n\n ~~~ BUTTON POSTS IN HERE /api/v1/slack_receive ~~~ \n\n\n");

	// is this an interactive message callback?
	if (req.body.payload) {

		// get a message object
		var message = JSON.parse(req.body.payload);
		for (var key in req.body) {
			message[key] = req.body[key];
		}

		// let's normalize some of these fields to match the rtm message format
		message.user = message.user.id;
		message.channel = message.channel.id;

		// put the action value in the text field
		// this allows button clicks to respond to asks
		message.text = message.actions[0].value;

		message.type = 'interactive_message_callback';

		slack_botkit.findTeamById(message.team.id, function (err, team) {
			if (err || !team) {
				slack_botkit.log.error('Received slash command, but could not load team');
			} else {
				res.status(200);
				res.send('');

				var bot = slack_botkit.spawn(team);

				bot.team_info = team;
				bot.res = res;

				slack_botkit.trigger('interactive_message_callback', [bot, message]);

				if (configuration.interactive_replies) {
					message.type = 'message';
					slack_botkit.receiveMessage(bot, message);
				}
			}
		});

		// this is a slash command
	} else if (req.body.command) {
			var message = {};

			for (var key in req.body) {
				message[key] = req.body[key];
			}

			// let's normalize some of these fields to match the rtm message format
			message.user = message.user_id;
			message.channel = message.channel_id;

			// Is this configured to use Slackbutton?
			// If so, validate this team before triggering the event!
			// Otherwise, it's ok to just pass a generic bot in
			if (slack_botkit.config.clientId && slack_botkit.config.clientSecret) {

				slack_botkit.findTeamById(message.team_id, function (err, team) {
					if (err || !team) {
						slack_botkit.log.error('Received slash command, but could not load team');
					} else {
						message.type = 'slash_command';
						// HEY THERE
						// Slash commands can actually just send back a response
						// and have it displayed privately. That means
						// the callback needs access to the res object
						// to send an optional response.

						res.status(200);

						var bot = slack_botkit.spawn(team);

						bot.team_info = team;
						bot.res = res;

						slack_botkit.receiveMessage(bot, message);
					}
				});
			} else {

				message.type = 'slash_command';
				// HEY THERE
				// Slash commands can actually just send back a response
				// and have it displayed privately. That means
				// the callback needs access to the res object
				// to send an optional response.

				var team = {
					id: message.team_id
				};

				res.status(200);

				var bot = slack_botkit.spawn({});

				bot.team_info = team;
				bot.res = res;

				slack_botkit.receiveMessage(bot, message);
			}
		} else if (req.body.trigger_word) {

			var message = {};

			for (var key in req.body) {
				message[key] = req.body[key];
			}

			var team = {
				id: message.team_id
			};

			// let's normalize some of these fields to match the rtm message format
			message.user = message.user_id;
			message.channel = message.channel_id;

			message.type = 'outgoing_webhook';

			res.status(200);

			var bot = slack_botkit.spawn(team);
			bot.res = res;
			bot.team_info = team;

			slack_botkit.receiveMessage(bot, message);

			// outgoing webhooks are also different. They can simply return
			// a response instead of using the API to reply.  Maybe this is
			// a different type of event!!
		}
});

exports.default = router;
//# sourceMappingURL=slack_receive.js.map