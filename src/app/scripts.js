/**
 * 		For fun one-off thingz
 */

import { bots, controller } from '../bot/controllers';
import models from './models';
import moment from 'moment-timezone';
import dotenv from 'dotenv';
import _ from 'lodash';
import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones, tokiExplainAttachments } from '../bot/lib/constants';


export function test(bot) {
	
	// U1NCGAETZ slackid of @test
	// U121ZK15J slackid of @kevin
	const SlackUserIds = `U1NCGAETZ,U121ZK15J`;
	bot.api.mpim.open({
		users: SlackUserIds
	}, (err, response) => {
		console.log(response);
		if (!err) {

			const { group: { id } } = response;
			bot.api.mpim.history({
				channel: id
			}, (err, response) => {

				if (!err) {

					const { messages } = response;
					console.log(`\n\n\n displaying the ${messages.length} messages for this convo`);
					console.log(messages[0]);
					const timeStampObject = moment.unix(messages[0].ts);
					console.log(`\n\n\n timestamp: ${timeStampObject.format()}`);

					if (messages[0].reactions) {
						console.log(messages[0].reactions);
					}

				}

			});

		}
	});

	// on session_start or session_end...
	// go through all the channels where this BOT is in the channel
	// then find the channels where the user who ended session is ALSO in the channel
	// if both are true, update that message with the user's updated status!

	bot.api.channels.list({
	}, (err, response) => {

		const BotSlackUserId = bot.identity.id;

		if (!err) {

			const { channels } = response;

			console.log(`\n\n\n there are ${channels.length} channels`);

			channels.forEach((channel) => {

				const { id, name, is_channel, topic, purpose, members } = channel;

				let hasBotSlackUserId    = false;
				let hasMemberSlackUserId = false;

				let KevinSlackUserId = `U121ZK15J`;
				let KevinTeamId = `T121VLM63`;

				_.some(members, (member) => {
					if (member == KevinSlackUserId) {
						hasBotSlackUserId = true;
					} else if (member == BotSlackUserId) {
						hasMemberSlackUserId = true;
					}
				});

				if (hasBotSlackUserId && hasMemberSlackUserId) {

					console.log(`\n\n\n channel name: ${name} has both members in slack user`);
					console.log(channel);

					models.Channel.find({
						where: { ChannelId: id }
					})
					.then((channel) => {

						const { ChannelId, tz } = channel;

						if (!tz) {
							console.log(`\n\n\n ERROR... NO TZ FOR CHANNEL: ${ChannelId}`);
							return;
						}

						models.Team.find({
							where: [`"Team"."TeamId" = ?`, KevinTeamId]
						})
						.then((team) => {

							models.User.find({
								where: { SlackUserId: KevinSlackUserId }
							})
							.then((user) => {

								user.getSessions({
									where: [ `"Session"."open" = ?`, true ],
									order: `"Session"."createdAt" DESC`,
									limit: 1
								})
								.then((sessions) => {

									let session = sessions[0];

									const { accessToken } = team.dataValues;

									if (accessToken) {

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

												console.log(`\n\n\n\n message count: ${messageCount}`);

												if (teamPulseDashboardMessage) {

													console.log(`\n\n\n this is the teamPulseDashboardMessage:`);
													console.log(teamPulseDashboardMessage);

													// update the attachments with the session info!
													let { text, attachments, ts } = teamPulseDashboardMessage;
													const updateTeamPulseDashboardMessageObject = {
														text,
														channel: ChannelId,
														ts
													};

													attachments = attachments.map((attachment) => {

														let { text, fields, color } = attachment;

														if (text == `<@${KevinSlackUserId}>`) {

															// update for this user!
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

															fields[0].value = sessionContent;
															fields[1].value = sessionTime;
															color           = sessionColor;

														}

														attachment.color  = color;
														attachment.fields = fields;

														return attachment;

													});

													updateTeamPulseDashboardMessageObject.attachments = JSON.stringify(attachments);
													bot.api.chat.update(updateTeamPulseDashboardMessageObject);

													if (messageCount > 15) {

														// if it's been over 15 messages since
														// team_pulse dashboard, then we should reset it
														// (i.e. delete => create new one)

														bot.send({
															channel: ChannelId,
															text: `Hey, it's been ${messageCount} since the dashboard so I refreshed it`
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


												}

											} else {

												console.log(`\n\n\n error in getting history of channel:`);
												console.log(err);

											}

										})

									} else {
										console.log(`\n\n\n could not find access token for user in slack channel`);
									}

								})
							});
						})
					})
				}
			});


		} else {
			console.log(`\n\n\n ~~ error in listing channel:`);
			console.log(err);
		}

	});

	bot.api.groups.create({
		name: `kevin-dashboard`
	}, (err, response) => {

		console.log(`\n\n\n group created:`);
		console.log(response);

	})

}

export function seedAndUpdateUsers(members) {

	members.forEach((member) => {

		const { id, team_id, name, tz } = member;

		const SlackUserId = id;

		models.User.find({
			where: { SlackUserId }
		})
		.then((user) => {

			if (user) {

				user.update({
					TeamId: team_id,
					SlackName: name
				});
				if (member.profile && member.profile.email) {
					const { profile: { email } } = member;
					if (email && user.email == '') {
						user.update({
							email
						})
					}
				}

			} else {

				console.log("\n\n ~~ new user and creating ~~ \n\n");
				let email = '';
				if (member.profile && member.profile.email)
					email = member.profile.email;
				models.User.create({
					SlackUserId,
					email,
					TeamId: team_id,
					SlackName: name,
				});

			}
		});

	});

}