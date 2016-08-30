import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { startEndSessionFlow } from './endSessionFunctions';
import { sendPing } from '../pings/pingFunctions';


// END OF A WORK SESSION
export default function(controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['end_session'], 'direct_message', wit.hears, (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		/**
		 * 			check if user has open session (should only be one)
		 * 					if yes, trigger finish and end_session flow
		 * 			  	if no, reply with confusion & other options
		 */
		
		const SlackUserId      = message.user;
		const endSessionType   = constants.endSessionTypes.endSessionEarly;

		const config = { SlackUserId, endSessionType };

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
			controller.trigger(`end_session_flow`, [bot, config]);
		}, 800);

	});

	/**
	 * 		User has confirmed to ending session
	 * 		This will immediately close the session, then move to
	 * 		specified "post session" options
	 */
	controller.on(`end_session_flow`, (bot, config) => {

		// pingInfo only relevant when endSessionType == `endByPingToUserId`
		const { SlackUserId, endSessionType, pingInfo } = config;

		models.User.find({
			where: { SlackUserId }
		})
		.then((user) => {

			const { tz } = user;
			const UserId = user.id;

			user.getSessions({
				where: [ `"open" = ?`, true ],
				order: `"Session"."createdAt" DESC`
			})
			.then((sessions) => {

				let session = sessions[0] || false;

				/*
				* 	1. get all the `endSession` pings for ToUserId 
				* 	2. get all the live sessions for FromUserId (pingers)
				* 	3. match up sessions with pings into `pingContainer` (`pingContainer.ping` && `pingContainer.session`)
				* 	4. run logic based on whether ping has session
				*/
				models.Ping.findAll({
					where: [ `("Ping"."ToUserId" = ? OR "Ping"."FromUserId" = ?) AND "Ping"."live" = ? AND "Ping"."deliveryType" = ?`, UserId, UserId, true, constants.pingDeliveryTypes.sessionEnd ],
					include: [
						{ model: models.User, as: `FromUser` },
						{ model: models.User, as: `ToUser` },
						models.PingMessage
					],
					order: `"Ping"."createdAt" ASC`
				}).then((pings) => {

					// this object holds pings in relation to the UserId of the session that just ended!
					// fromUser are pings that the user sent out
					// toUser are pings that got sent to the user
					// need to batch by unique fromUser <=> toUser combinations
					let pingContainers = {
						fromUser: { toUser: {} },
						toUser: { fromUser: {} }
					};

					// get all the sessions associated with pings that come FromUser
					let pingerSessionPromises = [];

					pings.forEach((ping) => {
						const { FromUserId, ToUserId } = ping;
						pingerSessionPromises.push(models.Session.find({
							where: {
								UserId: [ FromUserId, ToUserId ],
								live: true,
								open: true
							},
							include: [ models.User ]
						}));
					});

					Promise.all(pingerSessionPromises)
					.then((pingerSessions) => {

						// create the pingContainer by matching up `ping` with live `session`. then group it in the appropriate place in pingContainers
						// if no live session, `session` will be false
						pings.forEach((ping) => {

							const pingFromUserId      = ping.dataValues.FromUserId;
							const pingToUserId        = ping.dataValues.ToUserId;

							// these are pings from user who just ended ession
							if (pingFromUserId == UserId) {

								let pingContainer = pingContainers.fromUser.toUser[pingToUserId] || { session: false, pings: [] };

								pingerSessions.forEach((pingerSession) => {
									console.log(pingerSession);
									const pingerSessionUserId = pingerSession.dataValues.UserId;
									console.log(pingerSessionUserId);
									console.log(pingerSession);
									if (pingerSession && pingToUserId == pingerSessionUserId) {
										// recipient of ping is in session
										pingContainer.session = pingerSession;
										return;
									}
								});

								pingContainer.user = ping.dataValues.ToUser;
								pingContainer.pings.push(ping);
								pingContainers.fromUser.toUser[pingToUserId] = pingContainer;

							} else if (pingToUserId == UserId) {
								// these are pings to user who just ended session
								
								let pingContainer = pingContainers.fromUser.toUser[pingToUserId] || { session: false, pings: [] };

								pingerSessions.forEach((pingerSession) => {
									const pingerSessionUserId = pingerSession.dataValues.UserId;
									if (pingerSession && pingFromUserId == pingerSessionUserId) {
										pingContainer.session = pingerSession;
										return;
									}
								});

								pingContainer.user = ping.dataValues.FromUser;
								pingContainer.pings.push(ping);
								pingContainers.toUser.fromUser[pingFromUserId] = pingContainer;

							}

						});

						// attach only the relevant pingContainers (ones where FromUserId is not in live session or `superFocus` session)
						for (let fromUserId in pingContainers.toUser.fromUser) {

							if (!pingContainers.toUser.fromUser.hasOwnProperty(fromUserId)) {
								continue;
							}

							// delete if in superFocus session
							if (pingContainers.toUser.fromUser[fromUserId].session && pingContainers.toUser.fromUser[fromUserId].session.dataValues.superFocus) {
								delete pingContainers.toUser.fromUser[fromUserId];
							}
							
						}

						// this needs to now be split up into 2:
						// 1) batch up ping messages together
						// 2) send batchedPings through this `forEach` method

						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

							if (err) {
								console.log(`\n\n\n error! ${err} \n\n\n`);
								return;
							}

							// have 5-minute exit time limit
							convo.task.timeLimit = 1000 * 60 * 5;

							convo.sessionEnd = {
								UserId,
								SlackUserId,
								tz,
								pingContainers, // all `endSession` pings to handle
								endSessionType,
								pingInfo
							}

							// end the session if it exists!
							if (session) {

								let now     = moment();
								let endTime = moment(session.dataValues.endTime);
								if ( now < endTime )
									endTime = now;

								// END THE SESSION HERE
								session.update({
									open: false,
									live: false,
									endTime
								})
								.then((session) => {

									convo.sessionEnd.session = session;

									models.Session.update({
										open: false,
										live: false
									}, {
										where: [ `"Sessions"."UserId" = ? AND ("Sessions"."open" = ? OR "Sessions"."live" = ?)`, UserId, true, true ]
									});

									// start the flow after ending session
									startEndSessionFlow(convo);

								});
							} else {
								// go thru flow without session to end
								startEndSessionFlow(convo);
							}

							convo.on('end', (convo) => {

								// all the ping objects here are relevant!
								const { pingContainers, endSessionType } = convo.sessionEnd;



								// pings queued for user who just ended this session
								pingContainers.toUser.fromUser.foreach


								forEach((pingContainer) => {

									const { ping, ping: { dataValues: { FromUser, ToUser } }, session } = pingContainer;

									// if this ping is what ended session together,
									// no need to put user back through endSessionFlow
									// because FromUser's session has gotten ended
									if (thisPingEndedUsersSessionsTogether && pingInfo.SlackUserId == FromUser.dataValues.SlackUserId)
										continue;

									ping.getPingMessages({})
									.then((pingMessages) => {

										ping.update({
											live: false
										})
										.then(() => {

											// no live session, kick off the convo
											const fromUserConfig = {
												UserId: FromUser.dataValues.id,
												SlackUserId: FromUser.dataValues.SlackUserId,
												TeamId: FromUser.dataValues.TeamId
											};
											const toUserConfig = {
												UserId: ToUser.dataValues.id,
												SlackUserId: ToUser.dataValues.SlackUserId,
												TeamId: ToUser.dataValues.TeamId
											}
											const pingConfig = {
												deliveryType: constants.pingDeliveryTypes.sessionEnd,
												pingMessages
											};

											// send pings that are for ToUser!
											sendPing(fromUserConfig, toUserConfig, pingConfig);

											// put FromUser of these pings thru endSession flow!
											const endSessionConfig = {
												endSessionType: constants.endSessionTypes.endByPingToUserId,
												pingInfo: {
													PingId: ping.dataValues.id,
													FromUser,
													ToUser,
													session, // did this come while in session?
													endSessionType // whether OG user ended early or sessionTimerUp
												},
												SlackUserId: FromUser.dataValues.SlackUserId
											};

											if (thisPingEndedUsersSessionsTogether) {
												endSessionConfig.pingInfo.thisPingEndedUsersSessionsTogether = thisPingEndedUsersSessionsTogether;
											}
											controller.trigger(`end_session_flow`, [bot, endSessionConfig]);

										});
									});
									
								});

								// pings queued by user who just ended this session
								pingContainers.fromUser.toUser

								forEach((pingContainer) => {

									const { ping, ping: { dataValues: { FromUser, ToUser } }, session } = pingContainer;

									// only send the messages here when ToUser is not in a session
									ping.getPingMessages({})
									.then((pingMessages) => {
										if (!session) {
											// no live session, kick off the convo
											const fromUserConfig = {
												UserId: FromUser.dataValues.id,
												SlackUserId: FromUser.dataValues.SlackUserId,
												TeamId: FromUser.dataValues.TeamId
											};
											const toUserConfig = {
												UserId: ToUser.dataValues.id,
												SlackUserId: ToUser.dataValues.SlackUserId,
												TeamId: ToUser.dataValues.TeamId
											}
											const pingConfig = {
												deliveryType: constants.pingDeliveryTypes.sessionEnd,
												pingMessages
											};

											// send pings that are for ToUser!
											sendPing(fromUserConfig, toUserConfig, pingConfig);
										}
									})

								})
							});
						});

					});
				});

			});

		});

	});

}



