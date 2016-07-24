import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

import { bots, resumeQueuedReachouts } from '../index';

import { colorsArray, buttonValues, colorsHash, TOKI_DEFAULT_SNOOZE_TIME, sessionTimerDecisions } from '../../lib/constants';

// ALL OF THE TIMEOUT FUNCTIONALITIES
export default function(controller) {


	/**
	 * 			~~ START OF SESSION_OPTIONS FUNCTIONALITIES ~~
	 */

	controller.on(`session_pause_flow`, (bot, config) => {

		const { SlackUserId, botCallback } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			if (botCallback) {
				// if botCallback, need to get the correct bot
				var botToken = bot.config.token;
				bot          = bots[botToken];
			}

			user.getWorkSessions({
				where: [`"WorkSession"."open" = ?`, true],
				order: `"WorkSession"."createdAt" DESC`,
				limit: 1
			})
			.then((workSessions) => {

				// get most recent work session for snooze option
				if (workSessions.length > 0) {
					var workSession = workSessions[0];
					workSession.getDailyTasks({
						include: [ models.Task ]
					})
					.then((dailyTasks) => {

						workSession.DailyTasks = dailyTasks;

						var taskTextsToWorkOnArray = dailyTasks.map((dailyTask) => {
							var text = dailyTask.Task.dataValues.text;
							return text;
						});
						var tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

						// making this just a reminder now so that user can end his own session as he pleases
						bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

							convo.say({
								text: `Hey! Let's pause your session for ${tasksToWorkOnString}`,
							});

							convo.next();
						});
					})
				}
			})
		})
	});

	controller.on(`session_add_checkin_flow`, (bot, config) => {

		const { SlackUserId, botCallback } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			var { defaultBreakTime } = user;

			if (botCallback) {
				// if botCallback, need to get the correct bot
				var botToken = bot.config.token;
				bot          = bots[botToken];
			}

			user.getWorkSessions({
				where: [`"WorkSession"."open" = ?`, true],
				order: `"WorkSession"."createdAt" DESC`,
				limit: 1
			})
			.then((workSessions) => {

				if (workSessions.length > 0) {

					var workSession = workSessions[0];
					workSession.getDailyTasks({
						include: [ models.Task ]
					})
					.then((dailyTasks) => {

						bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

							convo.say(`~~Let's add a CHECKIN!!~~`);
							convo.next();

							convo.on('end', (convo) => {

							});
						});
					});
				}
			});
		});
	})

	controller.on(`session_end_early_flow`, (bot, config) => {

		const { SlackUserId, botCallback } = config;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot          = bots[botToken];
		}

		controller.trigger(`done_session_flow`, [bot, { SlackUserId }]);
		
	})

};