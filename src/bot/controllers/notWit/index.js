import os from 'os';
import { wit, bots } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { isJsonObject } from '../../middleware/hearsMiddleware';
import { utterances, colorsArray, constants, buttonValues, colorsHash, timeZones } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';
import { notInSessionWouldYouLikeToStartOne } from '../sessions';

import dotenv from 'dotenv';

/**
 * 		Sometimes there is a need for just NL functionality not related
 * 		to Wit and Wit intents. Put those instances here, since they will
 * 		show up before Wit gets a chance to pick them up first.
 */

export default function(controller) {

	controller.hears(['^pin[ng]{1,4}'], 'direct_message', (bot, message) => {

		const { intentObject: { entities: { intent, reminder, duration, datetime } } } = message;
		
		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId      = message.user;
		const { text }         = message;
		const pingSlackUserIds = getUniqueSlackUsersFromString(text);

		let pingMessages = [];
		if (pingSlackUserIds) {
			// this replaces up to "ping <@UIFSMIOM>"
			let pingMessage = text.replace(/^pi[ng]{1,4}([^>]*>)?/,"").trim()
			if (pingMessage) {
				pingMessages.push(pingMessage);
			}
		}

		let config = {
			SlackUserId,
			message,
			pingSlackUserIds,
			pingMessages
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			controller.trigger(`ping_flow`, [bot, config]);
		}, 650);

	});

	controller.hears(['^{'], 'direct_message',isJsonObject, function(bot, message) {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			
			try {
				let jsonObject = JSON.parse(text);
				const { updatePing, cancelPing, sendBomb, PingId } = jsonObject;
				if (updatePing) {
					const config = { PingId, sendBomb, cancelPing };
					controller.trigger(`update_ping_message`, [bot, config]);
				}
			}
			catch (error) {
				// this should never happen!
				bot.reply(message, "Hmm, something went wrong");
				return false;
			}

		}, 500);

	});

	// defer ping!
	controller.hears([utterances.deferPing], 'direct_message', function(bot, message) {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {

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

		}, 300);

	});


	controller.hears([constants.THANK_YOU.reg_exp], 'direct_message', (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "You're welcome!! :smile:");
		}, 500);
	});

	// when user wants to "change time and task" of an existing session,
	// it will basically create new session flow
	controller.hears([utterances.changeTimeAndTask], 'direct_message', (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			const config = { SlackUserId, changeTimeAndTask: true }
			controller.trigger(`begin_session_flow`, [bot, config]);
		}, 500);
	});

	// TOKI_T1ME TESTER
	controller.hears(['TOKI_T1ME'], 'direct_message', (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const { text } = message;
		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{

			controller.trigger(`TOKI_TIME_flow`, [ bot, { SlackUserId }]);

		}, 1000);

	});


	controller.on('TOKI_TIME_flow', (bot, config) => {

		const { SlackUserId } = config;

		// IncluderSlackUserId is the one who's actually using Toki
		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

			const { email, SlackName, tz } = user;

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				convo.say(`Hey, @${SlackName}!  Nice to meet ya`);

			});
		});
	});

}
