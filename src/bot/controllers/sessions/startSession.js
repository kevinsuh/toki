import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';
import _ from 'lodash';

import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import { confirmTimeZoneExistsThenStartSessionFlow } from './startSessionFunctions';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getStartSessionOptionsAttachment, commaSeparateOutStringArray } from '../../lib/messageHelpers';

// STARTING A SESSION
export default function(controller) {

	/**
	 *
	 * 		User directly asks to start a session
	 * 							~* via Wit *~
	 */
	controller.hears(['start_session'], 'direct_message', wit.hears, (bot, message) => {

		const { intentObject: { entities: { intent, reminder, duration, datetime } } } = message;
		
		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		let config = {
			SlackUserId,
			message
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

				if (tz) {
					let customTimeObject = witTimeResponseToTimeZoneObject(message, tz);
					if (customTimeObject) {
						let now = moment().tz(tz);
						let minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
						config.minutes = minutes;
					}
				}
				controller.trigger(`begin_session_flow`, [ bot, config ]);

			});

		}, 750);

	});

	/**
	 * 		ACTUAL START SESSION FLOW
	 * 		this will begin the start_session flow with user
	 *
	 * 			- start work session
	 * 			- show and decide tasks to work on
	 * 			- decide session duration
	 */
	controller.on('begin_session_flow', (bot, config) => {

		const { SlackUserId, content, minutes, changeTimeAndTask } = config;

		let botToken = bot.config.token;
		bot          = bots[botToken];

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

}

