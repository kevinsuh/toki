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

					models.User.findAll({
						where: [`"User"."SlackUserId" IN (?)`, members]
					})
					.then((users) => {

						let accessToken = false;

						// find the access token
						_.some(users, (user) => {
							if (user.dataValues.accessToken) {
								accessToken = user.dataValues.accessToken;
								return true;
							}
						});

						if (accessToken) {

							bot.api.channels.history({
								token: accessToken,
								channel: id
							}, (err, response) => {

								if (!err) {

									const { messages }               = response;
									let channelHasTeamPulseDashboard = false;
									let messageCount                 = 0;

									// iterate through messages to find
									// the `DASHBOARD_TEAM_PULSE` attachment
									_.some(messages, (message) => {

										// user is `SlackUserId`
										const { user, attachments } = message;

										// find the message of the team pulse
										if (user == BotSlackUserId && attachments && attachments[0].callback_id == constants.dashboardCallBackId) {
											console.log(`\n\n\n this is the message:`);
											console.log(message);
											channelHasTeamPulseDashboard = true;
											return channelHasTeamPulseDashboard;
										}

										messageCount++;

									});

									if (!channelHasTeamPulseDashboard) {
										// channel does not have pulse dashboard, let's insert one...
										
									} else if (messageCount > 15) {
										// if it's been over 15 messages since
										// team_pulse dashboard, then we should reset it
										// (i.e. delete => create new one)
										
										

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

					return;

				}


				if (name == 'distractions') {

					console.log(`\n\n in distractions:`);
					console.log(channel);
					console.log(members);
					// bot.send({
					// 	channel: id,
					// 	text: `<@U121ZK15J> is working on \`what if i ping myself\` until *3:31pm*`,
					// 	attachments: [
					// 		{
					// 			attachment_type: 'default',
					// 			callback_id: "LETS_FOCUS_AGAIN",
					// 			fallback: "Let's focus again!",
					// 			actions: [
					// 				{
					// 					name: `PING CHIP`,
					// 					text: "Send Message",
					// 					value: `{"pingUser": true, "PingToSlackUserId": "U121ZK15J"}`,
					// 					type: "button"
					// 				},
					// 			]
					// 		}
					// 	]
					// });

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