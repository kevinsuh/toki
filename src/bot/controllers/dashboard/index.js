import { wit, bots } from '../index';
import moment from 'moment-timezone';
import _ from 'lodash';
import models from '../../../app/models';
import dotenv from 'dotenv';

import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones, timeZoneAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString, getStartSessionOptionsAttachment, commaSeparateOutStringArray } from '../../lib/messageHelpers';
import { notInSessionWouldYouLikeToStartOne } from '../sessions';

export default function(controller) {

	/**
	 * HANDLE DASHBOARD HERE
	 */
	

	// joined a channel => make sure they want dashboard functionality
	controller.on([`channel_joined`, `group_joined`], (bot, message) => {

		const BotSlackUserId = bot.identity.id;

		console.log(`\n\n\n yo joined the channel or group. (bot id is ${BotSlackUserId}):`);
		console.log(message);

		const { type, channel: { id, creator, members, name } } = message;

		let botToken = bot.config.token;
		bot          = bots[botToken];

		// create channel record
		models.Channel.findOrCreate({
			where: { ChannelId: id }
		})
		.spread((channel, created) => {

			const { ChannelId, tz } = channel;

			const config = {
				ChannelId,
				BotSlackUserId
			}

			if (ChannelId && tz) {

				// this means Toki is just getting re-invited
				controller.trigger(`setup_dashboard_flow`, [ bot, config ]);

			} else {

				// creating Toki for the first time
				
				// get timezone for the channel
				bot.startPrivateConversation({ user: creator }, (err, convo) => {

					convo.dashboardConfirm = {
						ChannelId: id
					}

					// right now we cannot handle confirmation of dashboard because
					// we don't have channels:write permission		
					askTimeZoneForChannelDashboard(convo);

					// now trigger dashboard intro
					convo.on(`end`, (convo) => {

						// only way to get here is if timezone got updated.
						// now we can handle dashboard flow
						const { ChannelId } = convo.dashboardConfirm;

						controller.trigger(`setup_dashboard_flow`, [ bot, config ]);

					})

				});

			}

		})

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

	controller.on(`setup_dashboard_flow`, (bot, config) => {

		console.log(`\n\n ~~ setting up dashboard now ~~ \n\n`);
		console.log(config);

		const { ChannelId, BotSlackUserId, tz } = config;

		// 1. find ChannelId using Slack API
		// 2. get members of that channel
		// 3. make sure Toki is in the channel
		// 4. if so, post in it with the dashboard!
		
		bot.api.channels.info({
			channel: ChannelId
		}, (err, response) => {

			if (!err) {

				console.log(`\n\n\n successfully got channel in setup_dashboard_flow`);
				console.log(response);

				const { channel, channel: { id, name, members } } = response;

				models.Channel.find({
					where: { ChannelId: id }
				})
				.then((channel) => {

					const { tz, ChannelId } = channel;

					if (!tz) {
						console.log(`\n\n\n channel needs tz... \n\n\n`);
						return;
					}

					// introduction message
					bot.send({
						channel: ChannelId,
						text: `Hi! I'm Toki, your team's sidekick to make the most of your attention each day :raised_hands:\nI'll set up a dashboard here of your team's statuses each day. If you ever need a refresher on how I work, just say \`/explain\` and I'd love to go into more detail!`
					});

					let zoneAbbrString = moment().tz(tz).zoneAbbr(); // ex. EDT
					let todayString    = moment().tz(tz).format(`MMMM Do YYYY`); // ex. September 6th, 2016

					let text        = `:raised_hands: *Team Pulse for ${todayString}* :raised_hands:`;
					let attachments = [];

					let dashboardMemberSlackUserIds = [];
					members.forEach((MemberSlackUserId) => {

						if (MemberSlackUserId != BotSlackUserId) {
							dashboardMemberSlackUserIds.push(MemberSlackUserId);
						}

					});

					models.User.findAll({
						where: [ `"User"."SlackUserId" IN (?)`, dashboardMemberSlackUserIds ]
					})
					.then((users) => {

						let sessionPromises = [];
						let dashboardUsers  = {}; // by SlackUserId key i.e. dashboardUsers[`UI14242`] = {}

						users.forEach((user) => {

							sessionPromises.push(models.Session.find({
								where: {
									UserId: user.dataValues.id,
									live: true,
									open: true
								},
								include: [ models.User ]
							}));
							dashboardUsers[user.dataValues.SlackUserId] = {
								session: false,
								user: user
							};

						});

						let userSessions = []; // unique sessions only
						Promise.all(sessionPromises)
						.then((userSessions) => {

							userSessions.forEach((userSession) => {

								if (userSession && dashboardUsers[userSession.dataValues.User.SlackUserId]) {
									dashboardUsers[userSession.dataValues.User.SlackUserId].session = userSession;
								}

							});

							// you will have all the sessions and users here
							// now you must post the dashboard with the session info
							// via attachment that has specific msg

							console.log(`\n\n\n dashboardUsers object: `);
							console.log(dashboardUsers);

							/*
							 dashboardUsers object:
							{ U1NCGAETZ: { session: false },
							  U121ZK15J:
							   { session:
							      { dataValues: [Object],
							        _previousDataValues: [Object],
							        _changed: {},
							        '$modelOptions': [Object],
							        '$options': [Object],
							        hasPrimaryKeys: true,
							        __eagerlyLoadedAssociations: [],
							        isNewRecord: false,
							        User: [Object] } } }
							 */
							attachments = [{
								mrkdwn_in: [ "text", "fields" ],
								callback_id: constants.dashboardCallBackId,
								fields: [
									{
										title: "Current Priority",
										short: true
									},
									{
										title: `Until (${zoneAbbrString})`,
										short: true
									}
								],
								color: colorsHash.white.hex
							}];

							// iterate through dashboardUsers and put into alphabetized array
							let dashboardUsersArrayAlphabetical = [];
							_.forOwn(dashboardUsers, (value, key) => {

								// value is the object that has value.user and value.session
								dashboardUsersArrayAlphabetical.push(value);

							});

							dashboardUsersArrayAlphabetical.sort((a, b) => {
								
								let nameA = a.user.dataValues.SlackName;
								let nameB = b.user.dataValues.SlackName;
								return (nameA < nameB) ? -1 : (nameA > nameB) ? 1 : 0;

							});

							dashboardUsersArrayAlphabetical.forEach((dashboardUser) => {

								console.log(dashboardUser);

								const { session, user: { dataValues: { SlackUserId } } } = dashboardUser;

								let sessionContent;
								let sessionTime;
								let sessionColor;

								if (session) {
									sessionContent = `\`${session.dataValues.content}\``;
									sessionTime    = moment(session.dataValues.endTime).tz(tz).format("h:mma");
									sessionColor   = colorsHash.toki_purple.hex;
								} else {
									sessionContent = `_No active priority_`;
									sessionTime    = ``;
									sessionColor   = colorsHash.grey.hex;
								}

								// alphabetize the 
								attachments.push({
									attachment_type: 'default',
									callback_id: "DASHBOARD_SESSION_INFO_FOR_USER",
									fallback: `Here's the session info!`,
									text: `<@${SlackUserId}>`,
									mrkdwn_in: [ "text", "fields" ],
									fields: [
										{
											value: sessionContent,
											short: true
										},
										{
											value: sessionTime,
											short: true
										}
									],
									color: sessionColor,
									actions: [
										{
											name: "SEND_PING",
											text: "Send Message",
											value: `{"pingUser": true, "PingToSlackUserId": "${SlackUserId}"}`,
											type: "button"
										}
									]
								});

							});

							attachments.push({
								attachment_type: 'default',
								callback_id: "DASHBOARD_ACTIONS_FOR_USER",
								fallback: `Would you like to set a priority?`,
								mrkdwn_in: [ "text", "fields" ],
								color: colorsHash.toki_yellow.hex,
								text: "_What is your current priority?_",
								actions: [
									{
										name: "SET_PRIORITY",
										text: "Set My Priority",
										value: `{"setPriority": true}`,
										type: "button"
									}
								]
							});

/*

// this is the attachments that is about to send
[ { mrkdwn_in: [ 'text', 'fields' ],
    fields: [ [Object], [Object] ],
    color: '#ffffff' },
  { attachment_type: 'default',
    callback_id: 'DASHBOARD_SESSION_INFO_FOR_USER',
    fallback: 'Here\'s the session info!',
    text: '<@U121ZK15J>',
    mrkdwn_in: [ 'text', 'fields' ],
    fields: [ [Object], [Object] ],
    color: '#C1C1C3',
    actions: [ [Object] ] },
  { attachment_type: 'default',
    callback_id: 'DASHBOARD_SESSION_INFO_FOR_USER',
    fallback: 'Here\'s the session info!',
    text: '<@U1NCGAETZ>',
    mrkdwn_in: [ 'text', 'fields' ],
    fields: [ [Object], [Object] ],
    color: '#C1C1C3',
    actions: [ [Object] ] } ]
 */


							// send the message!
							bot.send({
								channel: ChannelId,
								text,
								attachments
							})

						})

					});

				})

/*
{ ok: true,
  channel:
   { id: 'C28K3L3K6',
     name: 'test-dashboard',
     is_channel: true,
     created: 1473168840,
     creator: 'U121ZK15J',
     is_archived: false,
     is_general: false,
     is_member: true,
     last_read: '1473175401.000034',
     latest:
      { user: 'U1J649CA0',
        inviter: 'U121ZK15J',
        text: '<@U1J649CA0|dev_navi> has joined the channel',
        type: 'message',
        subtype: 'channel_join',
        ts: '1473175404.000035' },
     unread_count: 1,
     unread_count_display: 0,
     members: [ 'U121ZK15J', 'U1J649CA0', 'U1NCGAETZ' ],
     topic: { value: '', creator: '', last_set: 0 },
     purpose:
      { value: 'test toki’s dashboard',
        creator: 'U121ZK15J',
        last_set: 1473168841 } } }
*/

			} else {

				console.log(`\n\n\n error in getting channel info in setup_dashboard_flow`);
				console.log(err);
				console.log(`\n\n\n`);

			}

		});

	});

}

function askTimeZoneForChannelDashboard(convo, text = '') {

	const { ChannelId } = convo.dashboardConfirm;

	if (text == '') {
		text = `Thanks for inviting me to <#${ChannelId}>! I'll introduce myself and set up a dashboard there of your team's priorities once I get which timezone you want it to operate in :raised_hands:`
	}

	convo.ask({
		text,
		attachments: timeZoneAttachments
	}, (response, convo) => {
		const { text } = response;
		let timeZoneObject = false;
		switch (text) {
			case (text.match(utterances.eastern) || {}).input:
				timeZoneObject = timeZones.eastern;
				break;
			case (text.match(utterances.central) || {}).input:
				timeZoneObject = timeZones.central;
				break;
			case (text.match(utterances.mountain) || {}).input:
				timeZoneObject = timeZones.mountain;
				break;
			case (text.match(utterances.pacific) || {}).input:
				timeZoneObject = timeZones.pacific;
				break;
			case (text.match(utterances.other) || {}).input:
				timeZoneObject = timeZones.other;
				break;
			default:
				break;
		}

		if (!timeZoneObject) {
			convo.say("I didn't get that :thinking_face:");
			askTimeZoneForChannelDashboard(convo, `Which timezone do you want the channel in?`);
			convo.next();
		} else if (timeZoneObject == timeZones.other) {
			convo.say(`Sorry!`);
			convo.say("Right now I’m only able to work in these timezones. If you want to demo Toki, just pick one of these timezones for now. I’ll try to get your timezone included as soon as possible!");
			askTimeZoneForChannelDashboard(convo, `Which timezone do you want to go with for now?`);
			convo.next();
		} else { // success!!

			const { tz } = timeZoneObject;
			console.log(timeZoneObject);
			models.Channel.update({
				tz
			}, {
				where: { ChannelId }
			})
			.then((user) => {
				convo.say(`Great! If your timezone for <#${ChannelId}> changes, you can always \`update settings\``);
				convo.next();
			});

		}

	});

}


