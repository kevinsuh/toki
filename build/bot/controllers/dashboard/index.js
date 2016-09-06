'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * HANDLE DASHBOARD HERE
  */

	// joined a channel => make sure they want dashboard functionality
	controller.on(['channel_joined', 'group_joined'], function (bot, message) {
		console.log('\n\n\n yo joined the channel or group:');
		console.log(message);

		var type = message.type;
		var _message$channel = message.channel;
		var id = _message$channel.id;
		var creator = _message$channel.creator;
		var members = _message$channel.members;
		var name = _message$channel.name;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		// creator is SlackUserIds, members is [ SlackUserIds ]

		// inform the creator of channel that this will become a dashboard
		// of your team's priorities
		bot.startPrivateConversation({ user: creator }, function (err, convo) {

			// right now we cannot handle confirmation of dashboard because
			// we don't have channels:write permission			
			convo.say('Thanks for inviting me to <#' + id + '>! I\'ll introduce myself and set up a dashboard there of your team\'s priorities :raised_hands:');
		});

		bot.send({
			channel: id,
			text: 'Hi! I\'m Toki, your team\'s sidekick to make the most of your attention each day :raised_hands:\nI\'ll set up a dashboard here of your team\'s statuses each day. If you ever need a refresher on how I work, just say `/explain` and I\'d love to go into more detail',
			attachments: [{
				attachment_type: 'default',
				callback_id: "LETS_FOCUS_AGAIN",
				fallback: "Let's focus again!",
				actions: [{
					name: 'PING CHIP',
					text: "Send Message",
					value: '{"pingUser": true, "PingToSlackUserId": "U121ZK15J"}',
					type: "button"
				}]
			}]
		});

		/*
  // CHANNEL
  yo joined the channel or group:
  { type: 'channel_joined',
  channel:
   { id: 'C28K3L3K6',
     name: 'test-dashboard',
     is_channel: true,
     created: 1473168840,
     creator: 'U121ZK15J',
     is_archived: false,
     is_general: false,
     is_member: true,
     last_read: '1473168840.000004',
     latest:
      { user: 'U1NCGAETZ',
        inviter: 'U121ZK15J',
        text: '<@U1NCGAETZ|test> has joined the channel',
        type: 'message',
        subtype: 'channel_join',
        ts: '1473168840.000004' },
     unread_count: 0,
     unread_count_display: 0,
     members: [ 'U121ZK15J', 'U1J649CA0', 'U1NCGAETZ' ],
     topic: { value: '', creator: '', last_set: 0 },
     purpose:
      { value: 'test toki’s dashboard',
        creator: 'U121ZK15J',
        last_set: 1473168841 } },
  intentObject: { _text: 'channel_joined', entities: { intent: false } } }
  // GROUP
  { type: 'group_joined',
  channel:
   { id: 'G285J09KP',
     name: 'testchannel',
     is_group: true,
     created: 1473025890,
     creator: 'U121U9CAU',
     is_archived: false,
     is_mpim: false,
     is_open: true,
     last_read: '1473168248.000031',
     latest:
      { user: 'U1J649CA0',
        text: '<@U1J649CA0|dev_navi> has left the group',
        type: 'message',
        subtype: 'group_leave',
        ts: '1473168248.000031' },
     unread_count: 0,
     unread_count_display: 0,
     members: [ 'U121U9CAU', 'U121ZK15J', 'U1F8T3HB6', 'U1J649CA0', 'U263PHCLQ' ],
     topic: { value: '', creator: 'U121U9CAU', last_set: 1473025890 },
     purpose: { value: '', creator: 'U121U9CAU', last_set: 1473025890 } },
  intentObject: { _text: 'group_joined', entities: { intent: false } } }
  	 */
	});

	/**
  * 	This is where we handle "Send Message" button and other buttons in dashboard
  */
	controller.hears(['^{'], 'ambient', _hearsMiddleware.isJsonObject, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		try {

			var jsonObject = JSON.parse(text);
			var pingUser = jsonObject.pingUser;
			var PingToSlackUserId = jsonObject.PingToSlackUserId;

			var config = {};
			if (pingUser) {
				config = { SlackUserId: SlackUserId, pingSlackUserIds: [PingToSlackUserId] };
				controller.trigger('ping_flow', [bot, null, config]);
			}
		} catch (error) {

			console.log(error);

			// this should never happen!
			bot.reply(message, "Hmm, something went wrong");
			return false;
		}
	});
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _hearsMiddleware = require('../../middleware/hearsMiddleware');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _sessions = require('../sessions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map