import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, buttonValues, colorsHash, constants, startSessionOptionsAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getUniqueSlackUsersFromString } from '../../lib/messageHelpers';
import { confirmTimeZoneExistsThenStartPingFlow, sendPing, queuePing, askForPingTime } from './pingFunctions';

// STARTING A SESSION
export default function(controller) {

	/**
	 *
	 * 		User directly asks to ping
	 * 							~* via Wit *~
	 */
	controller.hears(['ping'], 'direct_message', wit.hears, (bot, message) => {

		const { intentObject: { entities: { intent, reminder, duration, datetime } } } = message;
		
		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId      = message.user;
		const { text }         = message;
		const pingSlackUserIds = getUniqueSlackUsersFromString(text);

		let config = {
			SlackUserId,
			message,
			pingSlackUserIds
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			controller.trigger(`ping_flow`, [bot, config]);
		}, 650);

	});

	controller.hears(['^pin[ng]{1,4}'], 'direct_message', (bot, message) => {

		const { intentObject: { entities: { intent, reminder, duration, datetime } } } = message;
		
		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId      = message.user;
		const { text }         = message;
		const pingSlackUserIds = getUniqueSlackUsersFromString(text);

		let config = {
			SlackUserId,
			message,
			pingSlackUserIds
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			controller.trigger(`ping_flow`, [bot, config]);
		}, 650);

	});

	/**
	 * 		ACTUAL PING FLOW
	 * 		this will begin the ping flow with user
	 */
	controller.on('ping_flow', (bot, config) => {

		const { SlackUserId, message, pingSlackUserIds } = config;

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
					pingSlackUserIds
				}

				confirmTimeZoneExistsThenStartPingFlow(convo);

				convo.on(`end`, (convo) => {
					
					const { SlackUserId, tz, pingUserId, pingSlackUserId, pingTimeObject, userInSession, deliveryType, pingMessages } = convo.pingObject;

					const fromUserConfig = { UserId, SlackUserId };
					const toUserConfig   = { UserId: pingUserId, SlackUserId: pingSlackUserId };
					const config   = { userInSession, deliveryType, pingTimeObject, pingMessages }
					queuePing(bot, fromUserConfig, toUserConfig, config);

				})

			});

		});

	});

	/**
	 * 		BOMB THE PING MESSAGE
	 */
	controller.on(`update_ping_message`, (bot, config) => {

		const { PingId, sendBomb, cancelPing } = config;

		models.Ping.find({
			where: { id: PingId },
			include: [
				{ model: models.User, as: `FromUser` },
				{ model: models.User, as: `ToUser` },
			]
		})
		.then((ping) => {

			// this is a `bomb` to ToUser
			const { dataValues: { FromUser, ToUser } } = ping;

			const { tz } = FromUser.dataValues;

			bot.startPrivateConversation({ user: FromUser.dataValues.SlackUserId }, (err,convo) => {

				if (sendBomb) {
					convo.say(`:point_left: Got it! I just kicked off a conversation between you and <@${ToUser.dataValues.SlackUserId}>`);
				} else if (cancelPing) {
					convo.say(`The ping to <@${ToUser.dataValues.SlackUserId}> has been canceled!`);
				}

				convo.on(`end`, (convo) => {

					if (sendBomb) {
						models.Ping.update({
							live: true,
							deliveryType: "bomb"
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

}
