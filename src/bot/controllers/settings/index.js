import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { colorsArray, constants, buttonValues, colorsHash, timeZones, tokiOptionsAttachment, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, getSettingsAttachment } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, dateStringToMomentTimeZone, consoleLog, witTimeResponseToTimeZoneObject } from '../../lib/miscHelpers';

import { resumeQueuedReachouts } from '../index';
import { settingsHome } from './settingsFunctions';

// user wants to update settings!
export default function(controller) {

	controller.hears(['settings'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		var config = { SlackUserId };

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			controller.trigger(`settings_flow`, [ bot, config ]);
		}, 550);

	});

	/**
	 *      SETTINGS FLOW
	 */

	controller.on('settings_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			user.SlackUser.getIncluded({
				include: [ models.User ]
			})
			.then((includedSlackUsers) => {

				console.log(`\n\n included slack users: \n\n`);
				console.log(includedSlackUsers);

				const { nickName, defaultSnoozeTime, defaultBreakTime, wantsPing, pingTime, includeOthersDecision, SlackUser: { tz } } = user;
				var userTimeZone = {};
				for (var key in timeZones) {
					if (timeZones[key].tz == tz) {
						userTimeZone = timeZones[key];
					}
				}

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					// have 2-minute exit time limit
					convo.task.timeLimit = 120000;

					var name   = user.nickName || user.email;
					convo.name = name;

					// these are all pulled from the DB, then gets "re-updated" at the end. if nothing changed, then we will just re-update the same existing data
					convo.settings = {
						SlackUserId,
						timeZone: userTimeZone,
						nickName: name,
						defaultBreakTime,
						defaultSnoozeTime,
						wantsPing,
						pingTime,
						includeOthersDecision,
						includedSlackUsers
					}

					convo.say(`Hello, ${name}!`);
					settingsHome(convo);
					convo.next();

					convo.on('end', (convo) => {

						consoleLog("end of settings for user!!!!", convo.settings);

						const { SlackUserId, nickName, timeZone, defaultBreakTime, defaultSnoozeTime, wantsPing, pingTime, includeOthersDecision, includedSlackUsers } = convo.settings;

						if (timeZone) {
							const { tz } = timeZone;
							user.SlackUser.update({
								tz
							});
						}

						if (nickName) {
							user.update({
								nickName
							});
						}

						user.update({
							wantsPing
						});

						if (pingTime) {
							user.update({
								pingTime
							});
						}

						if (defaultSnoozeTime) {
							user.update({
								defaultSnoozeTime
							})
						}

						if (defaultBreakTime) {
							user.update({
								defaultBreakTime
							})
						}

						if (includeOthersDecision) {
							user.update({
								includeOthersDecision
							});
						}

						// 1. delete all included
						// 2. insert the newly included
						// (if user did not update this, this will just re-insert same user)
						models.Include.destroy({
							where: [ `"IncluderSlackUserId" = ?`, SlackUserId]
						});
						includedSlackUsers.forEach((slackUser) => {
							models.Include.create({
								IncluderSlackUserId: SlackUserId,
								IncludedSlackUserId: slackUser.dataValues.SlackUserId
							});
						});

						resumeQueuedReachouts(bot, { SlackUserId });

					});
				})
			});
		});
	});
}
