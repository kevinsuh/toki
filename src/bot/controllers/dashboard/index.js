import { wit, bots } from '../index';
import moment from 'moment-timezone';
import _ from 'lodash';
import models from '../../../app/models';
import dotenv from 'dotenv';

import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones, timeZoneAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString, getStartSessionOptionsAttachment, commaSeparateOutStringArray } from '../../lib/messageHelpers';
import { notInSessionWouldYouLikeToStartOne } from '../sessions';
import { updateDashboardForChannelId } from '../../lib/slackHelpers';

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

			models.User.find({
				where: { SlackUserId: creator }
			})
			.then((user) => {

				let promise = [];
				if (user && user.TeamId) {
					promise.push(channel.update({
						TeamId: user.TeamId
					}));
				}

				Promise.all(promise)
				.then(() => {

					// delete all teamPulseMessages for now and then create new one
					// when inviting for the first time
					models.Channel.find({
						where: { ChannelId }
					})
					.then((channel) => {

						const { ChannelId, tz, TeamId } = channel;

						models.Team.find({
							where: [`"Team"."TeamId" = ?`, TeamId]
						})
						.then((team) => {

							const { accessToken } = team;
							if (!accessToken) {
								console.log(`\n\n\n ERROR... NO ACCESS TOKEN FOR BOT: ${accessToken}`);
								return;
							}

							bot.api.channels.history({
								token: accessToken,
								channel: ChannelId
							}, (err, response) => {

								const { messages } = response;
								messages.forEach((message) => {

									// user is `SlackUserId`
									const { user, attachments, ts } = message;

									// find the message of the team pulse
									if (user == BotSlackUserId && attachments && attachments[0].callback_id == constants.dashboardCallBackId) {
										bot.api.chat.delete({
											ts,
											channel: ChannelId
										});
									}

								});

								if (tz) {
									// give a little time for all things to delete
									setTimeout(() => {
										controller.trigger(`setup_dashboard_flow`, [ bot, config ]);
									}, 500);
								} else {
									const timezoneConfig = {
										CreatorSlackUserId: creator,
										ChannelId
									}
									controller.trigger(`get_timezone_for_dashboard_flow`, [ bot, timezoneConfig ]);
								}

							});
						});
					});

				})

			});

		})

	});

	// this is set up for dashboard flow when tz does not exist
	controller.on(`get_timezone_for_dashboard_flow`, (bot, config) => {

		const { CreatorSlackUserId, ChannelId } = config;

		bot.startPrivateConversation({ user: CreatorSlackUserId }, (err, convo) => {

			convo.dashboardConfirm = {
				ChannelId
			}

			// right now we cannot handle confirmation of dashboard because
			// we don't have channels:write permission		
			askTimeZoneForChannelDashboard(convo);

			// now trigger dashboard intro
			convo.on(`end`, (convo) => {

				// only way to get here is if timezone got updated.
				// now we can handle dashboard flow
				const { ChannelId, neverMind } = convo.dashboardConfirm;

				if (neverMind) {
					return;
				}

				controller.trigger(`setup_dashboard_flow`, [ bot, config ]);

			})

		});

	})

	controller.on(`setup_dashboard_flow`, (bot, config) => {

		const { ChannelId, BotSlackUserId, tz } = config;

		// introduction message
		bot.send({
			channel: ChannelId,
			text: `Hi! I'm Toki, your team's sidekick to make the most of your attention each day :raised_hands:\nI'll set up a dashboard here of your team's statuses each day. If you ever need a refresher on how I work, just say \`/explain\` and I'd love to go into more detail!`
		}, () => {

			updateDashboardForChannelId(bot, ChannelId);

		});

	});

}

function askTimeZoneForChannelDashboard(convo, text = '') {

	const { ChannelId } = convo.dashboardConfirm;

	if (text == '') {
		text = `Thanks for inviting me to <#${ChannelId}>! I'll introduce myself and set up a dashboard there of your team's priorities once I get which timezone you want <#${ChannelId}> to operate in :raised_hands:`
	}

	convo.ask({
		text,
		attachments: timeZoneAttachments
	}, [
		{ // completedPriority
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.dashboardConfirm.neverMind = true;
				convo.say(`Okay! If you want me to set up a dashboard in <#${ChannelId}> in the future, please \`/remove\` me then \`/invite\` me in <#${ChannelId}> again :wave:`);
				convo.next();
			}
		},
		{ 
			default: true,
			callback: (response, convo) => {

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
			}
		}
	]);

}


