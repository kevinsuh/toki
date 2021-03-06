import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';
import dotenv from 'dotenv';

import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, witDurationToMinutes, convertMinutesToHoursString, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';
import { queuePing } from '../pings/pingFunctions';

export default function(controller) {

	/**
	 *      SLASH COMMAND FLOW
	 */
	controller.on('slash_command', (bot, message) => {

		const { team_id, user_id } = message;
		const { intentObject: { entities: { reminder, duration, datetime } } } = message;

		let text          = message.text.trim();
		const SlackUserId = message.user;
		let env           = process.env.NODE_ENV || 'development';

		if (env == "development") {
			message.command = message.command.replace("_dev","");
		}

		// make sure verification token matches!
		if (message.token !== process.env.VERIFICATION_TOKEN) {
			console.log(`\n ~~ verification token could not be verified ~~ \n`)
			return;
		}

		models.User.find({
			where: { SlackUserId }
		})
		.then((user) => {

			const { SlackName, tz } = user;
			const UserId = user.id;

			let now              = moment().tz(tz);
			const responseObject = { response_type: "ephemeral" }
			let slackNames       = getUniqueSlackUsersFromString(text, { normalSlackNames: true });

			let customTimeObject;
			let toSlackName = slackNames.length > 0 ? slackNames[0] : false;

			switch (message.command) {
				case "/focus":

					// if no session to end, offer to start new one right there
					user.getSessions({
						where: [ `"open" = ?`, true ],
						order: `"Session"."createdAt" DESC`
					})
					.then((sessions) => {
						
						let session = sessions[0];

						if (session) {
							const { content } = session.dataValues;
							responseObject.text = `You're already in a focus session for \`${content}\`!`;
						} else {
							responseObject.text = `Woo! You can do it :dancer:`;
						}

						controller.trigger(`begin_session_flow`, [ bot, message ]);
						bot.replyPrivate(message, responseObject);

					});
					
					break;

				case "/end":

					// if no session to end, offer to start new one right there
					user.getSessions({
						where: [ `"open" = ?`, true ],
						order: `"Session"."createdAt" DESC`
					})
					.then((sessions) => {
						
						let session = sessions[0];

						if (session) {

							const endSessionConfig = {
								SlackUserId,
								endSessionType: constants.endSessionTypes.endSessionEarly
							}

							controller.trigger(`end_session_flow`, [ bot, endSessionConfig ]);
							responseObject.text = `Okay! Let's end your current focus session`;
							bot.replyPrivate(message, responseObject);

						} else {

							responseObject.text = `You're not in a current session! Do you want to focus again?`;
							responseObject.attachments = [{
								attachment_type: 'default',
								callback_id: `NOT_IN_SESSION_LETS_FOCUS`,
								fallback: `Would you like to focus on something?`,
								mrkdwn_in: [ "text", "fields" ],
								color: colorsHash.toki_yellow.hex,
								actions: [
									{
										name: "SET_PRIORITY",
										text: "Let's focus!",
										value: `{"setPriority": true}`,
										type: "button"
									}
								]
							}];
							responseObject.channel = message.channel;
							bot.res.json(responseObject);

						}

					});
					
					break;

				case "/now":

					break;

				case "/pulse":

					// give pulse here in ephemeral message
					if (toSlackName) {

						models.User.find({
							where: {
								SlackName: toSlackName,
								TeamId: team_id
							}
						})
						.then((toUser) => {

							if (toUser) {

								// check if user is in session... if so, then do not DM receipt
								toUser.getSessions({
									where: [ `"open" = ?`, true ],
									order: `"Session"."createdAt" DESC`
								})
								.then((sessions) => {

									let session = sessions[0];

									if (session) {

										const { dataValues: { content, startTime, endTime } } = session;
										const now              = moment();
										const endTimeObject    = moment(endTime);
										const remainingMinutes = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());
										const remainingTimeString = convertMinutesToHoursString(remainingMinutes);

										responseObject.text = `<@${toUser.dataValues.SlackUserId}> is working on \`${content}\` for another *${remainingTimeString}*`;
										responseObject.attachments = [{
											attachment_type: 'default',
											callback_id: `IN_SESSION_PULSE`,
											fallback: `${toUser.dataValues.SlackName} is in a session!`,
											mrkdwn_in: [ "text", "fields" ],
											color: colorsHash.toki_purple.hex,
											actions: [
												{
													name: "SEND_PING",
													text: "Collaborate Now",
													value: `{"collaborateNow": true, "collaborateNowSlackUserId": "${toUser.dataValues.SlackUserId}"}`,
													type: "button"
												}
											]
										}];
										responseObject.channel = message.channel;
										bot.res.json(responseObject);

									} else {

										responseObject.text = `<@${toUser.dataValues.SlackUserId}> is not in a focus session. Would you like to talk with <@${toUser.dataValues.SlackUserId}> now?`;
										responseObject.attachments = [{
											attachment_type: 'default',
											callback_id: `IN_SESSION_PULSE`,
											fallback: `${toUser.dataValues.SlackName} is not in a session`,
											mrkdwn_in: [ "text", "fields" ],
											color: colorsHash.toki_purple.hex,
											actions: [
												{
													name: "SEND_PING",
													text: "Talk Now",
													value: `{"collaborateNow": true, "collaborateNowSlackUserId": "${toUser.dataValues.SlackUserId}"}`,
													type: "button"
												}
											]
										}];

										responseObject.channel = message.channel;
										bot.res.json(responseObject);
										
									}

								});

								
							} else {

								// user might have changed names ... this is very rare!
								bot.api.users.list({}, (err, response) => {
									if (!err) {
										const { members } = response;
										let foundSlackUserId = false;
										let toUserConfig = {}
										members.some((member) => {
											if (toSlackName == member.name) {
												const SlackUserId = member.id;
												models.User.update({
													SlackName: name
												},
												{
													where: { SlackUserId }
												});
												foundSlackUserId = SlackUserId;
												return true;
											}
										});

										if (foundSlackUserId) {

											responseObject.text = `That teammate recently changed names! I've updated my database. Can you send that command again?`;
											bot.replyPrivate(message, responseObject);


										} else {
											responseObject.text = `Hmm, sorry I couldn't find that teammate`;
											bot.replyPrivate(message, responseObject);
										}
									}
								})

							}

						})

					} else {

						// assume user wants own pulse (and let know if you want user? helper text is pretty clear...)
						user.getSessions({
							where: [ `"open" = ?`, true ],
							order: `"Session"."createdAt" DESC`
						})
						.then((sessions) => {

							let session = sessions[0];

							if (session) {

								const { dataValues: { content, startTime, endTime } } = session;
								const now              = moment();
								const endTimeObject    = moment(endTime);
								const remainingMinutes = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());
								const remainingTimeString = convertMinutesToHoursString(remainingMinutes);

								responseObject.text = `You are working on \`${content}\` for another *${remainingTimeString}*`;
								bot.replyPrivate(message, responseObject);

							} else {

								// not in session, would you like to start one?
								responseObject.text = `You're not in a current session! Do you want to focus again?`;
								responseObject.attachments = [{
									attachment_type: 'default',
									callback_id: `NOT_IN_SESSION_LETS_FOCUS`,
									fallback: `Would you like to focus on something?`,
									mrkdwn_in: [ "text", "fields" ],
									color: colorsHash.toki_yellow.hex,
									actions: [
										{
											name: "SET_PRIORITY",
											text: "Let's focus!",
											value: `{"setPriority": true}`,
											type: "button"
										}
									]
								}];
								responseObject.channel = message.channel;
								bot.res.json(responseObject);


							}

						});
						
					}
					break;

				case "/ping":

					// ping requires a receiving end
					if (toSlackName) {
						// if msg starts with @pinger, remove it from message
						let pingMessage = text[0] == "@" ? text.replace(/@(\S*)/,"").trim() : text;
						let pingMessages = [];
						if (pingMessage) pingMessages.push(pingMessage);

						// for now this automatically queues to end of session
						models.User.find({
							where: {
								SlackName: toSlackName,
								TeamId: team_id
							}
						})
						.then((toUser) => {

							if (toUser) { 

								// check if user is in session... if so, then do not DM receipt
								toUser.getSessions({
									where: [ `"open" = ?`, true ],
									order: `"Session"."createdAt" DESC`
								})
								.then((sessions) => {

									let session = sessions[0];

									if (session) {

										let pingFlowConfig = {
											SlackUserId,
											pingSlackUserIds: [ toUser.dataValues.SlackUserId ],
											pingMessages
										}

										controller.trigger(`ping_flow`, [bot, message, pingFlowConfig]);
										responseObject.text = `Got it! Let's deliver that ping :mailbox_with_mail:`;
										bot.replyPrivate(message, responseObject);

									} else {

										// user is not in session, no need for DM receipt!
										const fromUserConfig = { UserId, SlackUserId };
										const toUserConfig   = { UserId: toUser.dataValues.id, SlackUserId: toUser.dataValues.SlackUserId };
										const config   = {
											deliveryType: constants.pingDeliveryTypes.sessionNotIn,
											pingMessages
										};

										queuePing(bot, fromUserConfig, toUserConfig, config);
										responseObject.text = `<@${toUser.dataValues.SlackUserId}> is not in a session so I started a conversation for you. Thank you for being mindful of their attention :raised_hands:`;
										bot.replyPrivate(message, responseObject);
										

									}

								});

								
							} else {

								// user might have changed names ... this is very rare!
								bot.api.users.list({}, (err, response) => {
									if (!err) {
										const { members } = response;
										let foundSlackUserId = false;
										let toUserConfig = {}
										members.some((member) => {
											if (toSlackName == member.name) {
												const SlackUserId = member.id;
												models.User.update({
													SlackName: name
												},
												{
													where: { SlackUserId }
												});
												foundSlackUserId = SlackUserId;
												return true;
											}
										});

										if (foundSlackUserId) {
											models.User.find({
												where: { SlackUserId: foundSlackUserId }
											})
											.then((toUser) => {

												let pingFlowConfig = {
													SlackUserId, // fromUser SlackUserId
													message,
													pingSlackUserIds: [ toUser.dataValues.SlackUserId ],
													pingMessages
												}
												
												controller.trigger(`ping_flow`, [bot, pingFlowConfig]);
												responseObject.text = `Got it! Let's deliver that ping :mailbox_with_mail:`;
												bot.replyPrivate(message, responseObject);
											})
										}
									}
								})

							}

						})

					} else {
						responseObject.text = `Let me know who you want to send this ping to! (i.e. \`@emily\`)`;
						bot.replyPrivate(message, responseObject);
					}

					break;

				case "/explain":
					if (toSlackName) {

						// if msg starts with @pinger, remove it from message
						let pingMessage = text[0] == "@" ? text.replace(/@(\S*)/,"").trim() : text;
						// for now this automatically queues to end of session
						models.User.find({
							where: {
								SlackName: toSlackName,
								TeamId: team_id
							}
						})
						.then((toUser) => {

							if (toUser) {

								const config = {
									fromUserConfig: {
										UserId: user.dataValues.id,
										SlackUserId: user.dataValues.SlackUserId
									},
									toUserConfig: {
										UserId: toUser.dataValues.id,
										SlackUserId: toUser.dataValues.SlackUserId
									}
								};

								controller.trigger(`explain_toki_flow`, [ bot, config ]);

								responseObject.text = `Okay I just explained how I work to <@${toUser.dataValues.SlackUserId}>!`;
								bot.replyPrivate(message, responseObject);
							}
						});

					} else { // assume to self
						
						const explainConfig = {
							explainToSelf: true,
							UserConfig: {
								UserId: user.dataValues.id,
								SlackUserId: user.dataValues.SlackUserId
							}
						};

						controller.trigger(`explain_toki_flow`, [ bot, explainConfig ]);

						responseObject.text = `Thanks for asking me how I work! If you ever want to explain me to someone else, just include their username (i.e. \`@emily\`)`;
						bot.replyPrivate(message, responseObject);
					}
					break;
				default:
					responseObject.text = `I'm sorry, still learning how to \`${message.command}\`! :dog:`;
					bot.replyPrivate(message, responseObject);
					break;
			}


		});

	});

}
