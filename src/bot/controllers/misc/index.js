import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { colorsArray, constants, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, tokiOptionsExtendedAttachment } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, deleteConvoAskMessage } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog } from '../../lib/miscHelpers';

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
			const { nickName } = user;

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

						convo.say(`Hey! ${nickName} wanted me to share their top priorities with you today:\n${taskListMessage}`);
						convo.say(`If you have any questions about what ${nickName} is working on, please send them a Slack message :mailbox:`);

					});
				}

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

		if (message.text && message.text[0] == "/") {
			// ignore all slash commands
			console.log("\n\n ~~ ignoring a slash command ~~ \n\n");
			return;
		}

		const SlackUserId = message.user;

		consoleLog("in back up area!!!", message);

		var SECRET_KEY = new RegExp(/^TOKI_T1ME/);

		// user said something outside of wit's scope
		if (!message.selectedIntent) {

			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(() => {

				// different fallbacks based on reg exp
				const { text } = message;

				if (constants.THANK_YOU.reg_exp.test(text)) {
					// user says thank you
					bot.reply(message, "You're welcome!! :smile:");
				} else if (SECRET_KEY.test(text)) {

					consoleLog("UNLOCKED TOKI_T1ME!!!");
					/*
							
			*** ~~ TOP SECRET PASSWORD FOR TESTING FLOWS ~~ ***
							
					 */
					controller.trigger(`begin_onboard_flow`, [ bot, { SlackUserId } ]);

				} else {
					// end-all fallback
					var options = [ { title: 'start a day', description: 'get started on your day' }, { title: 'start a session', description: 'start a work session with me' }, { title: 'end session early', description: 'end your current work session with me' }];
					var colorsArrayLength = colorsArray.length;
					var optionsAttachment = options.map((option, index) => {
						var colorsArrayIndex = index % colorsArrayLength;
						return {
							fields: [
								{
									title: option.title,
									value: option.description
								}
							],
							color: colorsArray[colorsArrayIndex].hex,
							attachment_type: 'default',
							callback_id: "SHOW OPTIONS",
							fallback: option.description
						};
					});

					bot.reply(message, {
						text: "Hey! I'm here to help you with your 3 priorities for today. Let me know when you want to get started."
					});

				}

				resumeQueuedReachouts(bot, { SlackUserId });

			}, 1000);

		}

	});

}