import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';
import _ from 'lodash';

import { utterances, colorsArray, buttonValues, colorsHash, constants, timeZones } from '../../lib/constants';
import { confirmTimeZoneExistsThenStartSessionFlow } from './startSessionFunctions';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString, getStartSessionOptionsAttachment, commaSeparateOutStringArray, getSessionContentFromMessageObject } from '../../lib/messageHelpers';
import { notInSessionWouldYouLikeToStartOne } from './index';

// STARTING A SESSION
export default function(controller) {

	/**
	 *
	 * 		User directly asks to start a session
	 * 							~* via Wit *~
	 */
	controller.hears(['start_session'], 'direct_message', wit.hears, (bot, message) => {
		
		let botToken      = bot.config.token;
		bot               = bots[botToken];
		const SlackUserId = message.user;

		bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {

			convo.say(`It looks like you’re trying to focus! :palm_tree:`);
			convo.say("Just type `/focus [put task here] for [put duration here]`\nLike this `/focus squash front-end bug for 45 min` or `/focus marketing report until 4pm`");

		});

	});

	// this needs to be after Wit.hears `start_ession` because this is
	// a fallback. we want Wit to be trained to handle this!
	controller.hears([utterances.startsWithFocus], 'direct_message', (bot, message) => {
		
		let botToken      = bot.config.token;
		bot               = bots[botToken];
		const SlackUserId = message.user;

		bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {

			convo.say(`It looks like you’re trying to focus! :palm_tree:`);
			convo.say("Just type `/focus [put task here] for [put duration here]`\nLike this `/focus squash front-end bug for 45 min` or `/focus marketing report until 4pm`");

		});

	});

	/**
	 * 		ACTUAL START SESSION FLOW
	 * 		this will begin the start_session flow with user
	 *
	 * 			- start work session
	 * 			- show and decide tasks to work on
	 * 			- decide session duration
	 */
	controller.on('begin_session_flow', (bot, message, config = {}) => {

		let { content, changeTimeAndTask } = config;

		let botToken = bot.config.token;
		bot          = bots[botToken];

		let SlackUserId;
		let duration;
		let intent;
		let reminder;
		let datetime;
		let text; 

		if (message) {
			SlackUserId = message.user;
			const { text, intentObject: { entities: { intent, reminder, duration, datetime } } } = message;
			if (!content) {
				content = getSessionContentFromMessageObject(message);
			}
			bot.send({
				type: "typing",
				channel: message.channel
			});
		} else {
			SlackUserId = config.SlackUserId;
		}

		if (content) {
			// trim out if it starts with focus
			content = content.replace(/^focu[us]{1,3}/i,"").trim();
		}
	
		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

			// need user's timezone for this flow!
			const { tz } = user;
			const UserId = user.id;
			let minutes  = false;

			// we can only shortcut tz if we know message
			if (tz && message) {
				let customTimeObject = witTimeResponseToTimeZoneObject(message, tz);
				if (customTimeObject) {
					let now = moment().tz(tz);
					minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
				} else if (duration) {
					// if user puts in min and not picked up by customTimeObject
					config.minutes = witDurationToMinutes(duration);
				}
			}

			// check for an open session before starting flow
			user.getSessions({
				where: [`"open" = ?`, true]
			})
			.then((sessions) => {

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					// console.log(controller.tasks[0].convos);

					// have 5-minute exit time limit
					if (convo) {
						convo.task.timeLimit = 1000 * 60 * 5;
					}

					convo.sessionStart = {
						SlackUserId,
						UserId,
						tz,
						content,
						minutes
					}

					// check here if user is already in a session or not
					let currentSession = false;
					if (sessions.length > 0) {
						currentSession = sessions[0];
						convo.sessionStart.changeTimeAndTask = changeTimeAndTask;
					}

					convo.sessionStart.currentSession = currentSession;

					// entry point!
					confirmTimeZoneExistsThenStartSessionFlow(convo);
					convo.next();
					

					convo.on('end', (convo) => {

						const { sessionStart, sessionStart: { confirmNewSession, content, minutes, tz } } = convo;

						console.log("\n\n\n end of start session ");
						console.log(sessionStart);
						console.log("\n\n\n");

						let startTime = moment();
						let endTime   = moment().tz(tz).add(minutes, 'minutes');

						if (confirmNewSession) {

							// close all old sessions when creating new one
							models.Session.update({
								open: false,
								live: false
							}, {
								where: [ `"Sessions"."UserId" = ? AND ("Sessions"."open" = ? OR "Sessions"."live" = ?)`, UserId, true, true ]
							})
							.then(() => {

								models.Session.create({
									UserId,
									startTime,
									endTime,
									content
								}).then((session) => {

									// check if user has outstanding pings to others
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
											pingerSessionPromises.push(models.Session.findAll({
												where: {
													UserId: ToUserId,
													live: true,
													open: true
												},
												include: [ models.User ]
											}));
										});

										let pingerSessions = [];
										Promise.all(pingerSessionPromises)
										.then((pingerSessionsArrays) => {

											// returns double array of pingerSessions -- only get the unique ones!
											pingerSessionsArrays.forEach((pingerSessionsArray) => {
												let pingerSessionIds = pingerSessions.map(pingerSession => pingerSession.dataValues.id);
												pingerSessionsArray.forEach((pingerSession) => {
													if (!_.includes(pingerSessionIds, pingerSession.dataValues.id)) {
														pingerSessions.push(pingerSession);
													}
												});
											});

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

											let endTimeString = endTime.format("h:mma");

											bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

												let text = `:palm_tree: You're now in a focused session on \`${content}\` until *${endTimeString}* :palm_tree:`;
												let attachments = getStartSessionOptionsAttachment(pings);

												if (pings.length > 0) {

													// say session info, then provide ping options
													convo.say(text);

													// get slackNames and earliest endTime for pending fromUser pings
													let slackUserIds = [];
													let pingEndTime  = moment().tz(tz);

													pings.forEach((ping) => {
														const { dataValues: { deliveryType, ToUser, pingTime, session } } = ping;
														if (!_.includes(slackUserIds, ToUser.dataValues.SlackUserId)) {

															slackUserIds.push(ToUser.dataValues.SlackUserId);
															let thisPingEndTime;
															if (pingTime) {
																thisPingEndTime = moment(thisPingEndTime).tz(tz);
															} else if (deliveryType == constants.pingDeliveryTypes.sessionEnd && session) {
																thisPingEndTime = moment(session.dataValues.endTime).tz(tz);
															}

															if (thisPingEndTime > pingEndTime) {
																pingEndTime = thisPingEndTime;
															}

														}
													});

													// cant be deferred past my own session end!
													if (endTime < pingEndTime) {
														pingEndTime = endTime;
													}

													let pingEndTimeString = pingEndTime.format("h:mma");
													let slackNamesString  = commaSeparateOutStringArray(slackUserIds, { SlackUserIds: true });

													let outstandingPingText = pings.length == 1 ? `an outstanding ping` : `outstanding pings`;
													text = `You also have ${outstandingPingText} for ${slackNamesString} that will start a conversation for you at or before ${pingEndTimeString}`;
													convo.say({
														text,
														attachments
													});
													

												} else {
													// just start the session
													convo.say({
														text,
														attachments
													});
												}

											});

										});

									});

								});

							});

						}
					});
				
				});

			});
		});
	});

	/**
	 * 		SEND PING SOONER FLOW
	 * 		this is for sessions where ping wants to get sent as
	 * 		soon as ToUser is done with session
	 * 		this is the default when you enter a session
	 */
	
	controller.on(`send_sooner_flow`, (bot, message) => {

		const SlackUserId = message.user;
		const { text }    = message;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		// un-defer all pings from this user
		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

			// need user's timezone for this flow!
			const { tz } = user;
			const UserId = user.id;

			models.Session.find({
				where: {
					UserId,
					live: true,
					open: true
				}
			})
			.then((session) => {

				if (session) {
					session.update({
						superFocus: false
					})
					.then((session) => {

						const { dataValues: { endTime, content } } = session;
						const endTimeObject = moment(endTime).tz(tz);
						let endTimeString   = endTimeObject.format("h:mma");

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
								pingerSessionPromises.push(models.Session.findAll({
									where: {
										UserId: ToUserId,
										live: true,
										open: true
									},
									include: [ models.User ]
								}));
							});

							let pingerSessions = [];
							Promise.all(pingerSessionPromises)
							.then((pingerSessionsArrays) => {

								// returns double array of pingerSessions -- only get the unique ones!
								pingerSessionsArrays.forEach((pingerSessionsArray) => {
									let pingerSessionIds = pingerSessions.map(pingerSession => pingerSession.dataValues.id);
									pingerSessionsArray.forEach((pingerSession) => {
										if (!_.includes(pingerSessionIds, pingerSession.dataValues.id)) {
											pingerSessions.push(pingerSession);
										}
									});
								});

								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

									let text = `:palm_tree: You're in a focused session on \`${content}\` until *${endTimeString}* :palm_tree:`;
									let attachments = getStartSessionOptionsAttachment(pings);

									if (pings.length > 0) { // success in sendSooner!

										const config = { customOrder: true, order: ['deferPing', 'endSession'] };
										attachments  = getStartSessionOptionsAttachment(pings, config);

										// get slackNames and earliest endTime for pending fromUser pings
										let slackUserIds = [];
										let pingEndTime  = moment().tz(tz);

										pings.forEach((ping) => {
											const { dataValues: { deliveryType, ToUser, pingTime, session } } = ping;
											if (!_.includes(slackUserIds, ToUser.dataValues.SlackUserId)) {

												slackUserIds.push(ToUser.dataValues.SlackUserId);
												let thisPingEndTime;
												if (pingTime) {
													thisPingEndTime = moment(thisPingEndTime).tz(tz);
												} else if (deliveryType == constants.pingDeliveryTypes.sessionEnd && session) {
													thisPingEndTime = moment(session.dataValues.endTime).tz(tz);
												}

												if (thisPingEndTime > pingEndTime) {
													pingEndTime = thisPingEndTime;
												}

											}
										});

										// deferred ping cant be past endTime!
										if (endTimeObject < pingEndTime) {
											pingEndTime = endTimeObject;
										}

										let pingEndTimeString = pingEndTime.format("h:mma");
										let slackNamesString  = commaSeparateOutStringArray(slackUserIds, { SlackUserIds: true });

										let outstandingPingText = pings.length == 1 ? `Your ping` : `Your pings`;
										text = `${outstandingPingText} for ${slackNamesString}  will be delivered at or before ${pingEndTimeString}. Until then, good luck with \`${content}\`! :fist:`;

										convo.say({
											text,
											attachments
										});

									} else {
										// just continue the session
										convo.say({
											text,
											attachments
										});
									}

								});

							});
						});

					});
				} else {
					notInSessionWouldYouLikeToStartOne({bot, SlackUserId, controller})
				}

			});

		});

	});
	
	/**
	 * 		This is defer ping flow
	 * 		it will make session into `superFocus` mode (to be renamed)
	 * 		that means it will deferPings until after the session
	 */
	controller.on(`defer_ping_flow`, (bot, message) => {

		const SlackUserId = message.user;
		const { text }    = message;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		// defer all pings from this user
		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

			// need user's timezone for this flow!
			const { tz } = user;
			const UserId = user.id;

			models.Session.find({
				where: {
					UserId,
					live: true,
					open: true
				}
			})
			.then((session) => {

				if (session) {
					session.update({
						superFocus: true
					})
					.then((session) => {

						const { dataValues: { endTime, content } } = session;
						const endTimeObject = moment(endTime).tz(tz);
						let endTimeString   = endTimeObject.format("h:mma");

						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

							let text = `:palm_tree: I’ll follow up with you to send your message after your focused session on \`${content}\` ends at *${endTimeString}*. Good luck! :palm_tree:`;
							let attachments = [
								{
									attachment_type: 'default',
									callback_id: "DEFERRED_PING_SESSION_OPTIONS",
									fallback: "Good luck with your focus session!",
									actions: [
										{
											name: buttonValues.sendSooner.name,
											text: "Send Sooner",
											value: buttonValues.sendSooner.value,
											type: "button"
										},
										{
											name: buttonValues.endSession.name,
											text: "End Session",
											value: buttonValues.endSession.value,
											type: "button"
										}
									]
								}
							];

							convo.say({
								text,
								attachments
							});

						});

					})
				} else {
					notInSessionWouldYouLikeToStartOne({bot, SlackUserId, controller})
				}

			});

		});

	})

}

