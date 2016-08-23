import os from 'os';
import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, buttonValues, colorsHash, constants, startSessionOptionsAttachments } from '../../lib/constants';
import { finalizeSessionTimeAndContent } from './startSessionFunctions';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString } from '../../lib/messageHelpers';

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

				if (!tz) {
					bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
						convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
					});
					return;
				} else {
					let customTimeObject = witTimeResponseToTimeZoneObject(message, tz);
					if (customTimeObject) {
						let now = moment().tz(tz);
						let minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
						config.minutes = minutes;
					}
					controller.trigger(`begin_session`, [ bot, config ]);
				}

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
	controller.on('begin_session', (bot, config) => {

		const { SlackUserId, content, minutes } = config;

		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

			// need user's timezone for this flow!
			const { tz } = user;
			const UserId = user.id;

			if (!tz) {
				bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
					convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
				});
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				// have 5-minute exit time limit
				convo.task.timeLimit = 1000 * 60 * 5;

				convo.sessionStart = {
					SlackUserId,
					UserId,
					tz,
					bot,
					controller,
					content,
					minutes
				}

				// check for an open session before starting flow
				user.getSessions({
					where: [`"open" = ?`, true]
				})
				.then((sessions) => {

					let currentSession = false;

					if (sessions.length > 0) {
						currentSession = sessions[0];
					}
					convo.sessionStart.currentSession = currentSession;

					finalizeSessionTimeAndContent(convo);
					convo.next();

				});

				convo.on('end', (convo) => {

					const { sessionStart, sessionStart: { confirmNewSession, content, minutes } } = convo;

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

								let endTimeString = endTime.format("h:mma");

								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

									let text = `:weight_lifter: You’re now in a focused session on \`${content}\` until *${endTimeString}* :weight_lifter:`;
									convo.say({
										text,
										attachments: startSessionOptionsAttachments
									});

								});
							});

						});

					}
				});
			
			});

		});
	});

}
