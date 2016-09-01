import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString, getStartSessionOptionsAttachment, whichGroupedPingsToCancelAsAttachment, convertNumberStringToArray, commaSeparateOutStringArray } from '../../lib/messageHelpers';
import { confirmTimeZoneExistsThenStartPingFlow, queuePing, askForPingTime } from './pingFunctions';
import { notInSessionWouldYouLikeToStartOne } from '../sessions';


// STARTING A SESSION
export default function(controller) {

	/**
	 *		Enter ping flow via Wit
	 */
	controller.hears(['ping'], 'direct_message', wit.hears, (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		controller.trigger(`ping_flow`, [bot, message]);
		
	});


	/**
	 * 		ACTUAL PING FLOW
	 * 		this will begin the ping flow with user
	 */
	controller.on('ping_flow', (bot, message, config = {}) => {

		const { intentObject: { entities: { intent, reminder, duration, datetime } } } = message;

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId    = message.user;
		const { text }       = message;
		let pingSlackUserIds = getUniqueSlackUsersFromString(text);

		let pingMessages = [];
		if (pingSlackUserIds) {
			// this replaces up to "ping <@UIFSMIOM>"
			let pingMessage = text.replace(/^pi[ng]{1,4}([^>]*>)?/,"").trim()
			if (pingMessage) {
				pingMessages.push(pingMessage);
			}
		}

		// allow customization
		if (config) {
			if (config.pingMessages) {
				pingMessages = config.pingMessages;
			}
			if (config.pingSlackUserIds) {
				pingSlackUserIds = config.pingSlackUserIds;
			}
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {

			models.User.find({
				where: { SlackUserId }
			}).then((user) => {

				const { tz } = user;
				const UserId = user.id;

				bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {

					// have 5-minute exit time limit
					if (convo)
						convo.task.timeLimit = 1000 * 60 * 5;

					convo.pingObject = {
						SlackUserId,
						UserId,
						bot,
						tz,
						pingSlackUserIds,
						pingMessages
					}

					confirmTimeZoneExistsThenStartPingFlow(convo);

					convo.on(`end`, (convo) => {
						
						const { SlackUserId, tz, pingUserId, pingSlackUserId, pingTimeObject, userInSession, deliveryType, pingMessages, neverMind } = convo.pingObject;

						if (neverMind) // do not send if this is the cas!
							return;

						const fromUserConfig = { UserId, SlackUserId };
						const toUserConfig   = { UserId: pingUserId, SlackUserId: pingSlackUserId };
						const config   = { userInSession, deliveryType, pingTimeObject, pingMessages };

						queuePing(bot, fromUserConfig, toUserConfig, config);

					})

				});

			});

		}, 250);

	});

	/**
	 * 		BOMB THE PING MESSAGE FUNCTIONALITY (via button)
	 */
	controller.on(`update_ping_message`, (bot, config) => {

		const { PingId, sendBomb, cancelPing } = config;

		models.Ping.find({
			where: { id: PingId },
			include: [
				{ model: models.User, as: `FromUser` },
				{ model: models.User, as: `ToUser` },
				models.PingMessage
			]
		})
		.then((ping) => {

			// this is a `bomb` to ToUser
			const { dataValues: { FromUser, ToUser } } = ping;

			const { tz } = FromUser.dataValues;

			bot.startPrivateConversation({ user: FromUser.dataValues.SlackUserId }, (err,convo) => {

				if (sendBomb) {
					convo.say(`:point_left: Got it! I just kicked off a conversation between you and <@${ToUser.dataValues.SlackUserId}> for that ping`);
				} else if (cancelPing) {
					convo.say(`That ping to <@${ToUser.dataValues.SlackUserId}> has been canceled!`);
				}

				convo.on(`end`, (convo) => {

					if (sendBomb) {
						models.Ping.update({
							live: true,
							deliveryType: constants.pingDeliveryTypes.bomb
						}, {
							where: { id: PingId }
						});
					} else if (cancelPing) {
						models.Ping.update({
							live: false,
						}, {
							where: { id: PingId }
						});
					}

				});

			});

		})

	});

	/**
	 * 		CANCEL PINGS FUNCTIONALITY (i.e. while you are in middle of session)
	 */
	controller.on(`cancel_ping_flow`, (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		// get all of user's pings to others and then go through wizard to cancel
		// if only one ping, automatically cancel
		bot.send({
			type: "typing",
			channel: message.channel
		});
	
		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

			// need user's timezone for this flow!
			const { tz } = user;
			const UserId = user.id;

			// check for an open session before starting flow
			user.getSessions({
				where: [`"open" = ?`, true]
			})
			.then((sessions) => {

				let session = sessions[0];

				if (session) {

					const { dataValues: { endTime, content } } = session;
					const endTimeObject = moment(endTime).tz(tz);
					const endTimeString = endTimeObject.format("h:mma");

					models.Ping.findAll({
						where: [ `"Ping"."FromUserId" = ? AND "Ping"."live" = ?`, UserId, true ],
						include: [
							{ model: models.User, as: `FromUser` },
							{ model: models.User, as: `ToUser` },
							models.PingMessage
						],
						order: `"Ping"."createdAt" ASC`
					}).then((pings) => {

						// get all the sessions associated with pings that come FromUser
						let pingerSessionPromises = [];
						pings.forEach((ping) => {
							const { dataValues: { ToUserId } } = ping;
							pingerSessionPromises.push(models.Session.find({
								where: {
									UserId: ToUserId,
									live: true,
									open: true
								},
								include: [ models.User ]
							}));
						});

						Promise.all(pingerSessionPromises)
						.then((pingerSessions) => {

							pings.forEach((ping) => {

								const pingToUserId = ping.dataValues.ToUserId;
								pingerSessions.forEach((pingerSession) => {
									if (pingerSession && pingToUserId == pingerSession.dataValues.UserId) {
										// the session for ToUser of this ping
										ping.dataValues.session = pingerSession;
										return;
									}
								});

							});

							bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

								convo.cancelPingsObject = {
									pingIdsToCancel: []
								}

								if (pings.length == 0) {

									convo.say(`You have no pings to cancel!`);
									const text        = `Good luck with your focused session on \`${content}\` and I’ll see you at *${endTimeString}* :wave:`;
									const config      = { customOrder: true, order: ['endSession'] };
									const attachments = getStartSessionOptionsAttachment(pings, config);

									convo.say({
										text,
										attachments
									});
									
									convo.next();

								} else if (pings.length == 1) {

									// automatically cancel the single ping
									const ping = pings[0];
									const { dataValues: { ToUser, id } } = ping;

									convo.cancelPingsObject.pingIdsToCancel.push(id);

									convo.say(`The ping to <@${ToUser.dataValues.SlackUserId}> has been canceled!`);

									const text        = `Good luck with your focused session on \`${content}\` and I’ll see you at *${endTimeString}* :wave:`;
									const config      = { customOrder: true, order: ['endSession'] };
									const attachments = getStartSessionOptionsAttachment(pings, config);

									convo.say({
										text,
										attachments
									});

									convo.next();

								} else {

									// more than 1 ping to cancel, means ask which one to cancel!
									let text        = "Which ping(s) would you like to cancel? i.e. `1, 2` or `3`"
									let attachments = whichGroupedPingsToCancelAsAttachment(pings);

									convo.ask({
										text,
										attachments
									}, [
										{
											pattern: utterances.noAndNeverMind,
											callback: (response, convo) => {
												convo.say("Okay! I didn't cancel any pings");
												convo.next();
											}
										},
										{
											default: true,
											callback: (response, convo) => {

												const { text } = response;
												let numberArray = convertNumberStringToArray(text, pings.length);

												if (numberArray) {

													numberArray.forEach((number) => {
														let index = number - 1;
														if (pings[index]) {
															convo.cancelPingsObject.pingIdsToCancel.push(pings[index].dataValues.id);
														}
													});

													let pingNumberCancelString = commaSeparateOutStringArray(numberArray);

													if (convo.cancelPingsObject.pingIdsToCancel.length == 1) {
														convo.say(`Great, I've canceled ping ${pingNumberCancelString}!`);
													} else {
														convo.say(`Great, I've canceled pings ${pingNumberCancelString}!`);
													}

													
													const text        = `Good luck with your focused session on \`${content}\` and I’ll see you at *${endTimeString}* :wave:`;
													const config      = { customOrder: true, order: ['endSession'] };
													const attachments = getStartSessionOptionsAttachment(pings, config);

													convo.say({
														text,
														attachments
													});
													convo.next();

												} else {
													convo.say(`I didn't get that! Please put a combination of the numbers below`);
													convo.repeat();
												}
												convo.next();
											}
										}
									]);

								}

								convo.on('end', (convo) => {
									
									const { pingIdsToCancel } = convo.cancelPingsObject;

									pingIdsToCancel.forEach((pingIdToCancel) => {

										models.Ping.update({
											live: false
										}, {
											where: { id: pingIdToCancel }
										});

									})

								})

							});

						});


					});

				} else {
					// ask to start a session
					notInSessionWouldYouLikeToStartOne({bot, SlackUserId, controller});
				}

			});

		});



	});

}
