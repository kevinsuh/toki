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
				* 	3. match up sessions with pings into `pingObject` (`pingObject.ping` && `pingObject.session`)
				* 	4. run logic based on whether ping has session
				*/
				models.Ping.findAll({
					where: [ `("Ping"."ToUserId" = ? OR "Ping"."FromUserId" = ?) AND "Ping"."live" = ? AND "Ping"."deliveryType" = ?`, UserId, UserId, true, "sessionEnd" ],
					include: [
						{ model: models.User, as: `FromUser` },
						{ model: models.User, as: `ToUser` },
					],
					order: `"Ping"."createdAt" DESC`
				}).then((pings) => {

					// this object holds pings in relation to the UserId of the session that just ended!
					// fromUser are pings that the user sent out
					// toUser are pings that got sent to the user
					let pingObjects = {
						fromUser: [],
						toUser: []
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

						// create the pingObject by matching up `ping` with live `session`
						// if no live session, `session` will be false
						pings.forEach((ping) => {

							let pingObject  = {};
							let session     = false;
							pingObject.ping = ping;

							if (ping.dataValues.FromUserId == UserId) {
								// pings where user who just ended session has queued up
								pingerSessions.forEach((pingerSession) => {
									if (pingerSession && ping.dataValues.ToUserId == pingerSession.dataValues.UserId) {
										// recipient of ping is in session
										session = pingerSession;
										return;
									}
								});
								pingObject.session = session;
								pingObjects.fromUser.push(pingObject);
							} else if (ping.dataValues.ToUserId == UserId) {
								// pings where it is queued up for user who just ended session
								pingerSessions.forEach((pingerSession) => {
									if (pingerSession && ping.dataValues.FromUserId == pingerSession.dataValues.UserId) {
										session = pingerSession;
										return;
									}
								});
								pingObject.session = session;
								pingObjects.toUser.push(pingObject);
							}

						});

						// attach only the relevant pingObjects (ones where FromUserId is not in live session or `superFocus` session)
						pingObjects.toUser = pingObjects.toUser.filter(pingObject => !pingObject.session || !pingObject.session.dataValues.superFocus );

						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

							// have 5-minute exit time limit
							convo.task.timeLimit = 1000 * 60 * 5;

							convo.sessionEnd = {
								UserId,
								SlackUserId,
								tz,
								pingObjects, // all `endSession` pings to handle
								endSessionType,
								pingInfo
							}

							// end the session if it exists!
							if (session) {

								let now     = moment();
								let endTime = moment(session.dataValues.endTime);
								if ( now < endTime )
									endTime = now;

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
								const { pingObjects, endSessionType } = convo.sessionEnd;

								// pings queued for user who just ended this session
								pingObjects.toUser.forEach((pingObject) => {

									const { ping, ping: { dataValues: { FromUser, ToUser } }, session } = pingObject;

									// for this, all sessions that have not been filtered out yet should be started. if a session exists, then put that user thru end_session flow after turning off ping
									// config should be passed that provides them info
									// { endSessionType: `endByPingToUserId`, extraInfo.. }
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
												deliveryType: `sessionEnd`,
												pingMessages
											};

											sendPing(fromUserConfig, toUserConfig, pingConfig);

											// put FromUser of these pings thru endSession flow!
											const endSessionConfig = {
												endSessionType: constants.endSessionTypes.endByPingToUserId,
												pingInfo: {
													pingId: ping.dataValues.id,
													FromUser,
													ToUser,
													session, // did this come while in session?
													endSessionType // whether OG user ended early or sessionTimerUp
												},
												SlackUserId: FromUser.dataValues.SlackUserId
											}
											controller.trigger(`end_session_flow`, [bot, endSessionConfig]);

										});
									});
									
								});

								// pings queued by user who just ended this session
								pingObjects.fromUser.forEach((pingObject) => {

									const { ping, session } = pingObject;

									// for this, the pings where the ToUser is in a session will not be triggered (user is provided with a "send now" bomb option)
									// however, all pings where ToUser is not in a session (session == false), automatically trigger a conversation

								})
							});
						});

					});
				});

			});

		});

	});

}



