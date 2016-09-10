/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

import { constants, buttonValues, colorsHash, quotes, approvalWords, startSessionExamples, utterances, specialNumbers, decaNumbers } from './constants';
import { convertMinutesToHoursString } from './messageHelpers';
import nlp from 'nlp_compromise';
import moment from 'moment-timezone';
import _ from 'lodash';
import models from '../../app/models';

export function updateDashboardForChannelId(bot, ChannelId, config = {}) {

	const BotSlackUserId = bot.identity.id;
	const { statusUpdate } = config;

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

						const titleOfDashboard = {
							mrkdwn_in: [ "text", "fields" ],
							callback_id: constants.dashboardCallBackId,
							fallback: `Here's your team pulse!`,
							fields: [
								{
									title: "Current Focus",
									short: true
								},
								{
									title: `Until (${zoneAbbrString})`,
									short: true
								}
							],
							color: colorsHash.white.hex
						};

						attachments = [titleOfDashboard];

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

							const { session, user: { dataValues: { SlackUserId, SlackName, TeamId } } } = dashboardUser;

							let sessionContent;
							let sessionTime;
							let sessionColor;

							if (session) {
								sessionContent = `\`${session.dataValues.content}\``;
								sessionTime    = moment(session.dataValues.endTime).tz(tz).format("h:mma");
								sessionColor   = colorsHash.toki_purple.hex;
							} else {
								sessionContent = `_No current focus_`;
								sessionTime    = ``;
								sessionColor   = colorsHash.grey.hex;
							}

							// alphabetize the 
							attachments.push({
								attachment_type: 'default',
								callback_id: "DASHBOARD_SESSION_INFO_FOR_USER",
								fallback: `Here's the session info!`,
								text: `<slack://user?team=${TeamId}&id=${SlackUserId}|@${SlackName}>`,
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
										text: "Collaborate Now",
										value: `{"collaborateNow": true, "collaborateNowSlackUserId": "${SlackUserId}"}`,
										type: "button"
									}
								]
							});

						});

						let dashboardActions = {
							attachment_type: 'default',
							callback_id: constants.dashboardActions,
							fallback: `Would you like to do something?`,
							mrkdwn_in: [ "text", "fields" ],
							color: colorsHash.toki_yellow.hex,
							text: "_Would you like to do anything?_",
							actions: [
								{
									name: "SET_PRIORITY",
									text: "Let's Focus!",
									value: `{"setPriority": true}`,
									type: "button"
								}
							]
						};
						attachments.push(dashboardActions);

						bot.api.channels.history({
							token: accessToken,
							channel: ChannelId
						}, (err, response) => {

							if (!err) {

								const { messages }            = response;
								let teamPulseDashboardMessage = false;
								let messageCount              = 0;
								let updateMessage             = ''; // this is the message that will trigger beating of team-pulse

								// iterate through messages to find
								// the `DASHBOARD_TEAM_PULSE` attachment
								_.some(messages, (message) => {

									// user is `SlackUserId`
									const { user, attachments } = message;

									// find the most recent message of the team pulse (hopefully there is only 1)
									if (user == BotSlackUserId && attachments && attachments[0].callback_id == constants.dashboardCallBackId) {
										teamPulseDashboardMessage = message;
										return true;
									}

									messageCount++;

								});

								// if status update, send why you are pinging
								if (statusUpdate) {
									
									const { startSession, SlackUserId } = statusUpdate;

									if (startSession) {

										const startSessionObject = dashboardUsers[SlackUserId];
										const { session, user }  = startSessionObject;

										const { dataValues: { content, startTime, endTime } } = session;
										const { dataValues: { SlackName } } = user;

										const startTimeObject       = moment(startTime);
										const endTimeObject         = moment(endTime);
										const sessionMinutes        = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
										const sessionDurationString = convertMinutesToHoursString(sessionMinutes);

										const endTimeString = moment(endTime).tz(tz).format("h:mma");
										updateMessage = `*Update*: <@${SlackUserId}> is working on \`${content}\` for ${sessionDurationString} until *${endTimeString}*`;

									}

								}

								// either update existing dashboard, or create new one if one doesn't exist
								
								if (teamPulseDashboardMessage) {

									// update the attachments with the session info!
									let { ts } = teamPulseDashboardMessage;
									const teamPulseDashboardMessageObject = {
										channel: ChannelId,
										ts
									};

									// statusUpdate determines whether we send a new ping or not
									if (statusUpdate) {

										bot.api.chat.delete(teamPulseDashboardMessageObject, (err, res) => {

											if (!err) {

												const config = {
													bot,
													ChannelId,
													text,
													ts,
													titleOfDashboard,
													attachments,
													statusUpdate,
													statusUpdateMessage: updateMessage,
													dashboardUsers
												}

												sendNewDashboardObject(config);

											} else {
												console.log(`\n\n error in status update portion of dashboard object`);
												console.log(err);
											}

										});

									} else {

										// no statusUpdate => no ping, just update
										// i.e. `end_session` situation
										teamPulseDashboardMessageObject.text = text;
										if (attachments.length < 3) {
											let noUsers = true;
											attachments.forEach((attachment) => {
												const { callback_id } = attachment;
												// double check that no users are in focus session
												if (callback_id == `DASHBOARD_SESSION_INFO_FOR_USER`) {
													noUsers = false;
												}
											});

											if (noUsers) {
												delete attachments[0].fields;
												attachments.forEach((attachment) => {
													console.log(attachment);
													if (attachment.callback_id == constants.dashboardActions) {
														attachment.text = `Start a focus session by clicking the button below :point_down:\nI’ll post what you’re working on here so your team knows what you’re focused on :dancers:\nI’ll also snooze your non-urgent notifications :palm_tree:`;
													}
													teamPulseDashboardMessageObject.text = ` `;
												});
											}
											
										}

										teamPulseDashboardMessageObject.attachments = JSON.stringify(attachments);

										console.log(teamPulseDashboardMessageObject);
										bot.api.chat.update(teamPulseDashboardMessageObject);

									}


								} else {

									// if no dashboard exists, just create a new one
									
									const config = {
										bot,
										ChannelId,
										text,
										ts,
										titleOfDashboard,
										attachments,
										statusUpdate,
										statusUpdateMessage: updateMessage,
										dashboardUsers
									}

									sendNewDashboardObject(config);

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

// send a new dashboard object with given config
function sendNewDashboardObject(config) {

	const { bot, ChannelId, text, ts, titleOfDashboard, attachments, statusUpdate, statusUpdateMessage, dashboardUsers } = config;

	bot.send({
		channel: ChannelId,
		text,
		attachments: [ titleOfDashboard ]
	}, (err, response) => {

		// send without attachments then update, in order to avoid @mention of users in focus sessions
		let { ts, message: { text } } = response;
		text = `${text}`;
		const updateDashboardObject = {
			text,
			ts,
			channel: ChannelId
		}

		// 1. if this is your status update, we will mark channel as read
		if (statusUpdate) {

			const { SlackUserId } = statusUpdate;
			const { user }        = dashboardUsers[SlackUserId];

			if (user.dataValues) {

				bot.api.channels.mark({
					token: user.dataValues.accessToken,
					channel: ChannelId,
					ts
				}, (err, res) => {
					console.log(`\n\n success on mark`);
					console.log(err);
					console.log(res);
				});

			}

			// put status update msg at bottom
			attachments.push({
				attachment_type: 'default',
				callback_id: "STATUS_UPDATE_TO_DASHBOARD",
				fallback: `Here's the status update!`,
				pretext: statusUpdateMessage,
				mrkdwn_in: [ "pretext"]
			});

		}

		// 2. update dashboard msg
		updateDashboardObject.attachments = JSON.stringify(attachments);

		bot.api.chat.update(updateDashboardObject);

	});

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
