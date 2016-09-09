/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

import { constants, buttonValues, colorsHash, quotes, approvalWords, startSessionExamples, utterances, specialNumbers, decaNumbers } from './constants';
import nlp from 'nlp_compromise';
import moment from 'moment-timezone';
import _ from 'lodash';
import models from '../../app/models';

export function updateDashboardForChannelId(bot, ChannelId, config = {}) {

	const BotSlackUserId = bot.identity.id;

	models.Channel.find({
		where: { ChannelId }
	})
	.then((channel) => {

		const { ChannelId, tz, TeamId } = channel;

		if (!tz || !TeamId) {
			console.log(`\n\n\n ERROR... NO TZ OR TEAMID FOR CHANNEL: ${ChannelId} | ${TeamId}`);
			return;
		}

		// get channel info!
		bot.api.channels.info({
			channel: ChannelId
		}, (err, response) => {

			const { channel, channel: { id, name, members } } = response;

			let zoneAbbrString = moment().tz(tz).zoneAbbr(); // ex. EDT
			let todayString    = moment().tz(tz).format(`MMMM Do YYYY`); // ex. September 6th, 2016
			let text           = `:raised_hands: *Team Pulse for ${todayString}* :raised_hands:`;
			let attachments    = [];

			models.Team.find({
				where: [`"Team"."TeamId" = ?`, TeamId]
			})
			.then((team) => {

				const { accessToken } = team;

				if (!accessToken) {
					console.log(`\n\n\n ERROR... NO ACCESS TOKEN FOR BOT: ${accessToken}`);
					return;
				}

				let dashboardMemberSlackUserIds = [];
				members.forEach((MemberSlackUserId) => {

					if (MemberSlackUserId != BotSlackUserId) {
						dashboardMemberSlackUserIds.push(MemberSlackUserId);
					}

				});

				if (dashboardMemberSlackUserIds.length == 0) {
					console.log(`\n\n ~~ error no dashboard member slack user ids ~~ \n\n`);;
					return;
				}

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

						attachments = [{
							mrkdwn_in: [ "text", "fields" ],
							callback_id: constants.dashboardCallBackId,
							fallback: `Here's your team pulse!`,
							fields: [
								{
									title: "Currently Doing",
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

							const { session } = value;
							if (session) {
								// value is the object that has value.user and value.session
								dashboardUsersArrayAlphabetical.push(value);
							}
						});

						dashboardUsersArrayAlphabetical.sort((a, b) => {
					
							let nameA = a.user.dataValues.SlackName;
							let nameB = b.user.dataValues.SlackName;
							return (nameA < nameB) ? -1 : (nameA > nameB) ? 1 : 0;

						});

						dashboardUsersArrayAlphabetical.forEach((dashboardUser) => {

							const { session, user: { dataValues: { SlackUserId } } } = dashboardUser;

							let sessionContent;
							let sessionTime;
							let sessionColor;

							if (session) {
								sessionContent = `\`${session.dataValues.content}\``;
								sessionTime    = moment(session.dataValues.endTime).tz(tz).format("h:mma");
								sessionColor   = colorsHash.toki_purple.hex;
							} else {
								sessionContent = `_No status set_`;
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
							fallback: `Would you like to do something?`,
							mrkdwn_in: [ "text", "fields" ],
							color: colorsHash.toki_yellow.hex,
							text: "_Set your status:_",
							actions: [
								{
									name: "SET_PRIORITY",
									text: "Let's do it!",
									value: `{"setPriority": true}`,
									type: "button"
								}
							]
						});

						bot.api.channels.history({
							token: accessToken,
							channel: ChannelId
						}, (err, response) => {

							if (!err) {

								const { messages }            = response;
								let teamPulseDashboardMessage = false;
								let messageCount              = 0;

								// iterate through messages to find
								// the `DASHBOARD_TEAM_PULSE` attachment
								_.some(messages, (message) => {

									// user is `SlackUserId`
									const { user, attachments } = message;

									// find the message of the team pulse
									if (user == BotSlackUserId && attachments && attachments[0].callback_id == constants.dashboardCallBackId) {
										teamPulseDashboardMessage = message;
										return true;
									}

									messageCount++;

								});

								if (teamPulseDashboardMessage) {

									// update the attachments with the session info!
									let { ts } = teamPulseDashboardMessage;
									const updateTeamPulseDashboardMessageObject = {
										channel: ChannelId,
										ts,
										attachments
									};

									updateTeamPulseDashboardMessageObject.text        = text;
									updateTeamPulseDashboardMessageObject.attachments = JSON.stringify(attachments);
									bot.api.chat.update(updateTeamPulseDashboardMessageObject);

									if (messageCount > 15) {

										// if it's been over 15 messages since
										// team_pulse dashboard, then we should reset it
										// (i.e. delete => create new one)

										bot.send({
											channel: ChannelId,
											text: `Hey, looks like the dashboard has been pushed up by some messages, so here it is again!`
										}, () => {
											bot.api.chat.delete(updateTeamPulseDashboardMessageObject);
											bot.send({
												channel: ChannelId,
												text,
												attachments
											});
										})

									}

								} else {
									// channel does not have pulse dashboard, let's insert one...
									console.log(`\n\n\n no pulse dashboard... creating new one:`);
									bot.send({
										channel: ChannelId,
										text,
										attachments
									});

								}

							} else {

								console.log(`\n\n\n error in getting history of channel:`);
								console.log(err);

							}

						})


					});
					
				});
			});
		})
	})

}

export function checkIsNotAlreadyInConversation(controller, SlackUserId) {

	let valid = true;

	// at start of convo,
	// check if user is in conversation
	// if so, return and do not do another convo here.
	if (controller.tasks && controller.tasks.length > 0) {

		let userConversationsCount = 0;

		_.some(controller.tasks, (task) => {

			const { convos } = task;

			_.some(convos, (convo) => {

				const { source_message } = convo;
				console.log(source_message);

				if (source_message.channel && source_message.user && source_message.user == SlackUserId) {
					userConversationsCount++;
					return true;
				}

			});

		})

		if (userConversationsCount > 0) {
			console.log(`\n\n ~~ user is in a convo already!!! this conversation cannot happen due to double conversation ~~ \n\n`);
			valid = false;
		}

	}

	return valid;

}
