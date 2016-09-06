import { wit, bots } from '../index';
import moment from 'moment-timezone';
import _ from 'lodash';
import models from '../../../app/models';
import dotenv from 'dotenv';

import { isJsonObject } from '../../middleware/hearsMiddleware';
import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString, getStartSessionOptionsAttachment, commaSeparateOutStringArray } from '../../lib/messageHelpers';
import { notInSessionWouldYouLikeToStartOne } from '../sessions';

export default function(controller) {

	/**
	 * HANDLE DASHBOARD HERE
	 */
	

	// joined a channel => make sure they want dashboard functionality
	controller.on([`channel_joined`, `group_joined`], (bot, message) => {
		console.log(`\n\n\n yo joined the channel or group:`);
		console.log(message);

		const { type, channel: { id, creator, members, name } } = message;

		let botToken = bot.config.token;
		bot          = bots[botToken];

		// creator is SlackUserIds, members is [ SlackUserIds ]
		
		// inform the creator of channel that this will become a dashboard
		// of your team's priorities
		bot.startPrivateConversation({ user: creator }, (err, convo) => {

			// right now we cannot handle confirmation of dashboard because
			// we don't have channels:write permission			
			convo.say(`Thanks for inviting me to <#${id}>! I'll introduce myself and set up a dashboard there of your team's priorities :raised_hands:`);

		});

		bot.send({
			channel: id,
			text: `Hi! I'm Toki, your team's sidekick to make the most of your attention each day :raised_hands:\nI'll set up a dashboard here of your team's statuses each day. If you ever need a refresher on how I work, just say \`/explain\` and I'd love to go into more detail`,
			attachments: [
				{
					attachment_type: 'default',
					callback_id: "LETS_FOCUS_AGAIN",
					fallback: "Let's focus again!",
					actions: [
						{
							name: `PING CHIP`,
							text: "Send Message",
							value: `{"pingUser": true, "PingToSlackUserId": "U121ZK15J"}`,
							type: "button"
						},
					]
				}
			]
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
	controller.hears(['^{'], 'ambient', isJsonObject, function(bot, message) {


		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		try {

			let jsonObject = JSON.parse(text);
			const { pingUser, PingToSlackUserId } = jsonObject;
			let config = {};
			if (pingUser) {
				config = { SlackUserId, pingSlackUserIds: [ PingToSlackUserId ] };
				controller.trigger(`ping_flow`, [bot, null, config]);
			}

		}
		catch (error) {

			console.log(error);

			// this should never happen!
			bot.reply(message, "Hmm, something went wrong");
			return false;
		}

	});

}


