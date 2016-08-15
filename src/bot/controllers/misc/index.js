import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { colorsArray, constants, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, tokiOptionsExtendedAttachment } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, getRandomQuote } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog, getCurrentDaySplit } from '../../lib/miscHelpers';

import { resumeQueuedReachouts } from '../index';

export default function(controller) {

	// we'll stick our notifications flow here for now
	controller.on('notify_team_member', (bot, config) => {

		const { IncluderSlackUserId, IncludedSlackUserId } = config;

		// IncluderSlackUserId is the one who's actually using Toki
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, IncluderSlackUserId ],
			include: [ models.SlackUser ]
		}).then((user) => {

			const UserId       = user.id;
			const { nickName, SlackUser: { SlackName } } = user;
			const name = SlackName ? `@${SlackName}` : nickName;

			user.getDailyTasks({
				where: [`"DailyTask"."type" = ?`, "live"],
				include: [ models.Task ],
				order: `"Task"."done", "DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {

				dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

				let options         = { dontShowMinutes: true, dontCalculateMinutes: true };
				let taskListMessage = convertArrayToTaskListMessage(dailyTasks, options);

				if (IncludedSlackUserId) {
					bot.startPrivateConversation({ user: IncludedSlackUserId }, (err, convo) => {

						convo.notifyTeamMember = {
							dailyTasks
						};

						convo.say(`Hey! ${name} wanted me to share their top priorities with you today:\n${taskListMessage}`);
						convo.say(`If you have any questions about what ${name} is working on, please send them a Slack message :mailbox:`);

					});
				}

			});
		});
	});

	controller.on('user_morning_ping', (bot, config) => {

		const { SlackUserId } = config;

		// IncluderSlackUserId is the one who's actually using Toki
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [ models.SlackUser ]
		}).then((user) => {

			const UserId       = user.id;
			const { nickName, SlackUser: { tz } } = user;

			const day      = moment().tz(tz).format('dddd');
			const daySplit = getCurrentDaySplit(tz);

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				let goodMorningMessage = `Good ${daySplit}, ${nickName}!`;
				const quote = getRandomQuote();

				convo.say({
					text: `${goodMorningMessage}\n*_"${quote.message}"_*\n-${quote.author}`,
					attachments:[
						{
							attachment_type: 'default',
							callback_id: "MORNING_PING_START_DAY",
							fallback: "Let's start the day?",
							color: colorsHash.grey.hex,
							actions: [
								{
										name: buttonValues.letsWinTheDay.name,
										text: ":pencil:Let’s win the day:trophy:",
										value: buttonValues.letsWinTheDay.value,
										type: "button",
										style: "primary"
								}
							]
						}
					]
				});

			});
		});
	});

	controller.hears([constants.THANK_YOU.reg_exp], 'direct_message', (bot, message) => {
		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "You're welcome!! :smile:");
			resumeQueuedReachouts(bot, { SlackUserId });
		}, 500);
	});

	/**
	 * DEFAULT FALLBACK
	 */
	controller.hears([constants.ANY_CHARACTER.reg_exp], 'direct_message', (bot, message) => {
		const SlackUserId = message.user;
		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.reply(message, "Hey! I have some limited functionality as I learn my specific purpose :dog: If you're still confused, please reach out to my creators Chip or Kevin");
			resumeQueuedReachouts(bot, { SlackUserId });
		}, 500);
	});

	// this will send message if no other intent gets picked up
	controller.hears([''], 'direct_message', wit.hears, (bot, message) => {

		// user said something outside of wit's scope
		if (!message.selectedIntent) {

			bot.send({
				type: "typing",
				channel: message.channel
			});

		}

	});

}


function TEMPLATE_FOR_TEST(bot, message) {

	const SlackUserId = message.user;

	models.User.find({
		where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
		include: [
			models.SlackUser
		]
	}).then((user) => {

		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

			var name = user.nickName || user.email;

			// on finish convo
			convo.on('end', (convo) => {
				
			});

		});
	});
}

