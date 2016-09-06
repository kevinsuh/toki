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

		var BotSlackUserId = bot.identity.id;

		console.log('\n\n\n yo joined the channel or group. (bot id is ' + BotSlackUserId + '):');
		console.log(message);

		var type = message.type;
		var _message$channel = message.channel;
		var id = _message$channel.id;
		var creator = _message$channel.creator;
		var members = _message$channel.members;
		var name = _message$channel.name;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		// create channel record
		_models2.default.Channel.findOrCreate({
			where: { ChannelId: id }
		}).then(function (channel) {
			var ChannelId = channel.ChannelId;
			var tz = channel.tz;


			if (ChannelId && tz) {

				// this means Toki is just getting re-invited
				controller.trigger('setup_dashboard_flow', [bot, config]);
			} else {
				// creating Toki for the first time

				// get timezone for the channel
				bot.startPrivateConversation({ user: creator }, function (err, convo) {

					convo.dashboardConfirm = {
						ChannelId: id
					};

					// right now we cannot handle confirmation of dashboard because
					// we don't have channels:write permission		
					askTimeZoneForChannelDashboard(convo);

					// now trigger dashboard intro
					convo.on('end', function (convo) {

						// only way to get here is if timezone got updated.
						// now we can handle dashboard flow
						var ChannelId = convo.dashboardConfirm.ChannelId;

						var config = {
							ChannelId: ChannelId
						};
						controller.trigger('setup_dashboard_flow', [bot, config]);
					});
				});
			}
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

	controller.on('setup_dashboard_flow', function (bot, config) {

		console.log('\n\n ~~ setting up dashboard now ~~ \n\n');
		console.log(config);

		var ChannelId = config.ChannelId;

		// 1. find ChannelId using Slack API
		// 2. get members of that channel
		// 3. make sure Toki is in the channel
		// 4. if so, post in it with the dashboard!


		// bot.send({
		// 			channel: id,
		// 			text: `Hi! I'm Toki, your team's sidekick to make the most of your attention each day :raised_hands:\nI'll set up a dashboard here of your team's statuses each day. If you ever need a refresher on how I work, just say \`/explain\` and I'd love to go into more detail`
		// 		});

		// 		let dashboardMessage = {};

		// 		// Attention board for September 6, 2016
		// 		members.forEach((MemberSlackUserId) => {


		// 			if (MemberSlackUserId != BotSlackUserId) {
		// 				// ignore if bot is the member

		// 			}


		// 		})
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

			var _config = {};
			if (pingUser) {
				_config = { SlackUserId: SlackUserId, pingSlackUserIds: [PingToSlackUserId] };
				controller.trigger('ping_flow', [bot, null, _config]);
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

function askTimeZoneForChannelDashboard(convo) {
	var text = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var ChannelId = convo.dashboardConfirm.ChannelId;


	if (text == '') {
		text = 'Thanks for inviting me to <#' + ChannelId + '>! I\'ll introduce myself and set up a dashboard there of your team\'s priorities once I get which timezone you want it to operate in :raised_hands:';
	}

	convo.ask({
		text: text,
		attachments: _constants.timeZoneAttachments
	}, function (response, convo) {
		var text = response.text;

		var timeZoneObject = false;
		switch (text) {
			case (text.match(_constants.utterances.eastern) || {}).input:
				timeZoneObject = _constants.timeZones.eastern;
				break;
			case (text.match(_constants.utterances.central) || {}).input:
				timeZoneObject = _constants.timeZones.central;
				break;
			case (text.match(_constants.utterances.mountain) || {}).input:
				timeZoneObject = _constants.timeZones.mountain;
				break;
			case (text.match(_constants.utterances.pacific) || {}).input:
				timeZoneObject = _constants.timeZones.pacific;
				break;
			case (text.match(_constants.utterances.other) || {}).input:
				timeZoneObject = _constants.timeZones.other;
				break;
			default:
				break;
		}

		if (!timeZoneObject) {
			convo.say("I didn't get that :thinking_face:");
			askTimeZoneForChannelDashboard(convo, 'Which timezone do you want the channel in?');
			convo.next();
		} else if (timeZoneObject == _constants.timeZones.other) {
			convo.say('Sorry!');
			convo.say("Right now I’m only able to work in these timezones. If you want to demo Toki, just pick one of these timezones for now. I’ll try to get your timezone included as soon as possible!");
			askTimeZoneForChannelDashboard(convo, 'Which timezone do you want to go with for now?');
			convo.next();
		} else {
			// success!!

			var _timeZoneObject = timeZoneObject;
			var tz = _timeZoneObject.tz;

			console.log(timeZoneObject);
			_models2.default.Channel.update({
				tz: tz
			}, {
				where: { ChannelId: ChannelId }
			}).then(function (user) {
				convo.say('Great! If your timezone for <#' + ChannelId + '> changes, you can always `update settings`');
				convo.next();
			});
		}
	});
}
//# sourceMappingURL=index.js.map