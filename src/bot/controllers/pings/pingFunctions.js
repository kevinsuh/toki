import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getRandomExample, commaSeparateOutStringArray, getMostRecentMessageToUpdate, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';

/**
 * 		PING CONVERSATION FLOW FUNCTIONS
 */

export function startPingFlow(convo) {

	const { SlackUserId, tz, pingSlackUserIds }  = convo.pingObject;

	if (pingSlackUserIds) {
		handlePingSlackUserIds(convo);
	} else {
		askWhoToPing(convo);
	}

}

function askWhoToPing(convo, text = `Who would you like to ping? You can type their username, like \`@emily\``) {

	const { SlackUserId, tz, pingSlackUserIds }  = convo.pingObject;

	let attachments = [{
		attachment_type: 'default',
		callback_id: "WHO_TO_PING",
		fallback: "Who would you like to ping?",
		actions: [{
				name: buttonValues.neverMind.name,
				text: `Never Mind!`,
				value: buttonValues.neverMind.value,
				type: `button`
			}]
	}];

	convo.ask({
		text,
		attachments
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say(`Ok! Just let me know if you want to ping someone on your team`); // in future check if in session
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				const { text } = response;
				const pingSlackUserIds = getUniqueSlackUsersFromString(text);

				if (pingSlackUserIds.length > 0) {

					convo.pingObject.pingSlackUserIds = pingSlackUserIds;
					handlePingSlackUserIds(convo);

				} else {
					askWhoToPing(convo, `Whoops! Try *typing @ + the first few letters of the intended recipient’s first name*, like \`@matt\` , then clicking on the correct recipient`);
				}

				convo.next();

			}
		}
	])

}

function handlePingSlackUserIds(convo) {

	const { SlackUserId, tz, bot, pingSlackUserIds }  = convo.pingObject;

	if (pingSlackUserIds) {

		let pingSlackUserId              = pingSlackUserIds[0];
		convo.pingObject.pingSlackUserId = pingSlackUserId;

		models.User.find({
			where: { SlackUserId: pingSlackUserId },
		})
		.then((user) => {

			if (user) {

				const { SlackName, id } = user;
				convo.pingObject.pingUserId = id;

				// we will only handle 1
				if (pingSlackUserIds.length > 1) {
					convo.say(`Hey! Right now I only handle one recipient DM, so I'll be helping you with <@${user.dataValues.SlackUserId}>. Feel free to queue another message right after this!`);
				}

				// user found, handle the ping flow!
				user.getSessions({
					where: [ `"open" = ?`, true ],
					order: `"Session"."createdAt" DESC`
				})
				.then((sessions) => {

					let session = sessions[0];

					if (session) {
						// queue the message
						let { content, endTime } = session.dataValues;

						let now           = moment().tz(tz);
						let endTimeObject = moment(endTime).tz(tz);
						let endTimeString = endTimeObject.format("h:mma");
						let minutesLeft   = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());

						convo.say(`<@${user.dataValues.SlackUserId}> is focusing on \`${content}\` until *${endTimeString}*`);
						convo.pingObject.userInSession = {
							user,
							endTimeObject
						};
						askForQueuedPingMessages(convo);

					} else {
						// send the message
						convo.say(`:point_left: <@${user.dataValues.SlackUserId}> is not in a focused work session right now, so I started a conversation for you`);
						convo.say(`Thank you for being mindful of <@${user.dataValues.SlackUserId}>'s attention :raised_hands:`);
						convo.next();
					}

				});
				
			} else {
				// could not find user
				
				bot.api.users.info({ user: pingSlackUserId }, (err, response) => {
					if (!err) {
						const { user: { id, team_id, name, tz } } = response;
						const email = user.profile && user.profile.email ? user.profile.email : '';
						models.User.create({
							TeamId: team_id,
							email,
							tz,
							SlackUserId: id,
							SlackName: name
						})
						.then(() => {
							handlePingSlackUserIds(convo);
						});
					} else {
						convo.say(`Sorry, I can't recognize that user!`);
						askWhoToPing(convo);
					}
				});

			}

			convo.next();

		});

	} else {
		startPingFlow(convo);
	}

}

function askForQueuedPingMessages(convo) {

	const { SlackUserId, bot, tz, userInSession }  = convo.pingObject;

	if (userInSession) {
		// we gathered appropriate info about user
		const { user, endTimeObject } = userInSession;
		const endTimeString = endTimeObject.format("h:mma");
		let now            = moment().tz(tz);
		let minutesLeft    = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());

		let text = `What would you like me to send <@${user.dataValues.SlackUserId}> at *${endTimeString}*?`;
		let attachments = [{
			text: "Enter as many lines as you’d like to include in the message then choose one of the send options when your message is ready to go\n(These few lines will delete after you type your first line and hit Enter :wink:)",
			attachment_type: 'default',
			callback_id: "PING_MESSAGE_LIST",
			mrkdwn_in: ["text"],
			fallback: "What is the message you want to queue up?"
		}];

		let pingMessages = [];

		convo.ask({
			text,
			attachments
		}, [
			{
				pattern: utterances.containsSendAt,
				callback: (response, convo) => {

					convo.pingObject.pingMessages = pingMessages;

					let text = '';

					// if date here, pre-fill it
					let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
					if (customTimeObject) {

						// equal times
						let customTimeString = customTimeObject.format("h:mma");

						if (customTimeString == endTimeString) {
							// sessionEnd ping
							convo.pingObject.deliveryType = "sessionEnd";
							convo.say(`Thank you for being mindful of <@${user.dataValues.SlackUserId}>’s attention :raised_hands:`);
							convo.say(`I’ll send your message at *${customTimeString}*! :mailbox_with_mail:`);
							convo.next();

						} else {

							if (now < customTimeObject && customTimeObject < endTimeObject) {
								// grenade ping
								convo.pingObject.pingTimeObject = customTimeObject;
								convo.pingObject.deliveryType   = "grenade";
								convo.say(`Excellent! I’ll be sending your message to <@${user.dataValues.SlackUserId}> at *${customTimeObject.format("h:mma")}* :mailbox_with_mail:`);

							} else {
								// invalid time for grenade ping
								let minutesBuffer = Math.round(minutesLeft / 4);
								now = moment().tz(tz);
								let exampleEndTimeObjectOne = now.add(minutesBuffer, 'minutes');
								now = moment().tz(tz);
								let exampleEndTimeObjectTwo = now.add(minutesLeft - minutesBuffer, 'minutes');
								convo.say(`The time has to be between now and ${endTimeString}. You can input times like \`${exampleEndTimeObjectOne.format("h:mma")}\` or \`${exampleEndTimeObjectTwo.format("h:mma")}\``);
								text = "When would you like to send your urgent message?";

							}

							askForPingTime(convo, text);
							convo.next();

						}
					}
				}
			},
			{
				pattern: utterances.sendSooner,
				callback: (response, convo) => {

					convo.pingObject.pingMessages = pingMessages;

					askForPingTime(convo);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

					pingMessages.push(response.text);

					let pingMessageListUpdate = getMostRecentMessageToUpdate(response.channel, bot, "PING_MESSAGE_LIST");
					if (pingMessageListUpdate) {

						attachments[0].actions = [
							{
								name: buttonValues.sendAtEndOfSession.name,
								text: `Send at ${endTimeString}`,
								value: `Send at ${endTimeString}`,
								type: `button`
							},
							{
								name: buttonValues.sendSooner.name,
								text: `Send sooner :bomb:`,
								value: buttonValues.sendSooner.value,
								type: `button`
							}
						];

						attachments[0].text = pingMessages.length == 1 ? response.text : `${attachments[0].text}\n${response.text}`;
						attachments[0].color = colorsHash.toki_purple.hex;

						pingMessageListUpdate.attachments = JSON.stringify(attachments);
						bot.api.chat.update(pingMessageListUpdate);

					}

				}
			}
		]);

	} else {
		startPingFlow(convo);
	}

}

function askForPingTime(convo, text = '') {

	const { SlackUserId, bot, tz, pingTimeObject, pingSlackUserId, userInSession }  = convo.pingObject;

	// if user is in a session and you have not set what time you want to ping yet
	if (!pingTimeObject && userInSession) {

		const { user, endTimeObject } = userInSession;

		let now            = moment().tz(tz);
		let minutesLeft    = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());
		let exampleEndTimeObject;
		if (minutesLeft > 10) {
			exampleEndTimeObject = now.add(minutesLeft - 10, 'minutes')
		} else {
			exampleEndTimeObject = now.add(Math.round(minutesLeft / 2), 'minutes');
		}
		
		let exampleEndTimeString = exampleEndTimeObject.format("h:mma");
		let endTimeString        = endTimeObject.format("h:mma");

		if (text == '') {
			text = `Would you like to send this urgent message now, or at a specific time before ${endTimeString}? If it’s the latter, just tell me the time, like \`${exampleEndTimeString}\``;
		}

		const attachments = [{
			attachment_type: 'default',
			callback_id: "PING_GRENADE",
			fallback: "When do you want to ping?",
			actions: [{
				name: buttonValues.now.name,
				text: `Now :bomb:`,
				value: buttonValues.now.value,
				type: `button`
			}]
		}];

		convo.ask({
			text,
			attachments
		}, [
			{
				pattern: utterances.containsNow,
				callback: (response, convo) => {
					// send now
					convo.pingObject.deliveryType = "bomb";
					convo.say(`:point_left: Got it! I'll send your message to <@${user.dataValues.SlackUserId}> :runner: :pencil:`);
					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {

					let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
					if (customTimeObject) {
						now = moment().tz(tz);
						if (now < customTimeObject && customTimeObject < endTimeObject) {
							// success!
							convo.pingObject.pingTimeObject = customTimeObject;
							convo.pingObject.deliveryType   = "grenade";
							convo.say(`Excellent! I’ll be sending your message to <@${user.dataValues.SlackUserId}> at *${customTimeObject.format("h:mma")}* :mailbox_with_mail:`);
						} else {
							// has to be less than or equal to end time
							let minutesBuffer = Math.round(minutesLeft / 4);
							now = moment().tz(tz);
							let exampleEndTimeObjectOne = now.add(minutesBuffer, 'minutes');
							now = moment().tz(tz);
							let exampleEndTimeObjectTwo = now.add(minutesLeft - minutesBuffer, 'minutes');
							convo.say(`The time has to be between now and ${endTimeString}. You can input times like \`${exampleEndTimeObjectOne.format("h:mma")}\` or \`${exampleEndTimeObjectTwo.format("h:mma")}\``);
							askForPingTime(convo, "When would you like to send your urgent message?");
						}
							
					} else {

						convo.say(`I didn't quite get that :thinking_face:`);
						convo.repeat();

					}

					convo.next();

				}
			}
		]);

	}

	convo.next();

}

/**
 * 
 * This handles logic of sending ping depending on session info
 * 
 * @param  {bot} bot      requires bot of TeamId
 * @param  {UserId, SlackUserId} fromUserConfig
 * @param  {UserId, SlackUserId} toUserConfig
 * @param  {deliveryType, pingTimeObject, pingMessages } config   [description]
 */
export function sendPing(bot, fromUserConfig, toUserConfig, config) {

	const { pingTimeObject, pingMessages } = config;
	let { deliveryType } = config;

	if (!deliveryType) deliveryType = "endSession"; // default to endSession ping

	let SlackUserIds = `${fromUserConfig.SlackUserId},${toUserConfig.SlackUserId}`;

	models.User.find({
		where: { SlackUserId: toUserConfig.SlackUserId },
	})
	.then((toUser) => {

		if (toUser) {

			// user found, handle the ping flow!
			toUser.getSessions({
				where: [ `"open" = ?`, true ],
				order: `"Session"."createdAt" DESC`
			})
			.then((sessions) => {

				let session = sessions[0];

				if (session) {

					models.Ping.create({
						FromUserId: fromUserConfig.UserId,
						ToUserId: toUserConfig.UserId,
						deliveryType,
						pingTime: pingTimeObject
					})
					.then((ping) => {
						if (pingMessages) {
							pingMessages.forEach((pingMessage) => {
								models.PingMessage.create({
									PingId: ping.id,
									content: pingMessage
								})
							})
						}
					})

				} else {

					bot.api.mpim.open({
						users: SlackUserIds
					}, (err, response) => {
						if (!err) {
							const { group: { id } } = response;
							let text = `Hey <@${toUserConfig.SlackUserId}>! You're not in a session and <@${fromUserConfig.SlackUserId}> wanted to reach out :raised_hands:`;
							let attachments = [];

							bot.startConversation({ channel: id }, (err, convo) => {

								if (pingMessages) {
									pingMessages.forEach((pingMessage) => {
										attachments.push({
											text: pingMessage,
											mrkdwn_in: ["text"],
											attachment_type: 'default',
											callback_id: "PING_MESSAGE",
											fallback: pingMessage,
											color: colorsHash.toki_purple.hex
										});
									});
								}
								convo.say({
									text,
									attachments
								});
								convo.next();

							})
						}
					});

				}

			});
			
		} else {

			bot.startPrivateConversation({ user: fromUserConfig.SlackUserId }, (err,convo) => {

				// could not find user, let's create
				bot.api.users.info({ user: toUserConfig.SlackUserId }, (err, response) => {

					if (!err) {
						const { user: { id, team_id, name, tz } } = response;
						const email = user.profile && user.profile.email ? user.profile.email : '';
						models.User.create({
							TeamId: team_id,
							email,
							tz,
							SlackUserId: id,
							SlackName: name
						})
						.then(() => {
							convo.say(`For some reason, i didn't have <@${id}> in my database, but now I do! Thank you. Try sending this ping again :pray:`);
						});
					} else {
						convo.say(`Sorry, I can't recognize <@${id}>!`);
					}

				});

				convo.next();

			});

		}

	});

}

