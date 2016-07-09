import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';
import { askUserPostSessionOptions, handlePostSessionDecision } from './endWorkSession';

import { bots } from '../index';

import { colorsArray, buttonValues, colorsHash, TOKI_DEFAULT_SNOOZE_TIME, sessionTimerDecisions } from '../../lib/constants';

// ALL OF THE TIMEOUT FUNCTIONALITIES
export default function(controller) {


	/**
	 * 			~~ START OF SESSION_TIMER FUNCTIONALITIES ~~
	 */

	// we put users in this ether when it has been a 30 mintime out!
	controller.on(`done_session_timeout_flow`, (bot, config) => {

		const { SlackUserId, workSession } = config;
		var dailyTaskIds = workSession.DailyTasks.map((dailyTask) => {
			return dailyTask.id;
		});

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

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
								text: `Hey! It's been 30 minutes since you wanted to finish ${tasksToWorkOnString}. Did you finish the task?`,
								attachments:[
									{
										attachment_type: 'default',
										callback_id: "DONE_SESSION",
										fallback: "I was unable to process your decision",
										actions: [
											{
													name: buttonValues.doneSessionTimeoutYes.name,
													text: "Yes! :punch:",
													value: buttonValues.doneSessionTimeoutYes.value,
													type: "button",
													style: "primary"
											},
											{
													name: buttonValues.doneSessionTimeoutSnooze.name,
													text: "Snooze :timer_clock:",
													value: buttonValues.doneSessionTimeoutSnooze.value,
													type: "button"
											},
											{
													name: buttonValues.doneSessionTimeoutDidSomethingElse.name,
													text: "Did something else",
													value: buttonValues.doneSessionTimeoutDidSomethingElse.value,
													type: "button"
											},
											{
													name: buttonValues.doneSessionTimeoutNo.name,
													text: "Nope",
													value: buttonValues.doneSessionTimeoutNo.value,
													type: "button"
											}
										]
									}
								]
							});
							convo.say("Please click one of the items above if applicable!");
							convo.next();
						});
					})
				}
			})
		})
	})

	// `yes` button flow
	controller.on(`done_session_yes_flow`, (bot, config) => {

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

				if (workSessions.length > 0) {

					var workSession = workSessions[0];
					workSession.getDailyTasks({
						include: [ models.Task ]
					})
					.then((dailyTasks) => {

						workSession.DailyTasks = dailyTasks;
						var completedTaskIds = workSession.DailyTasks.map((dailyTask) => {
							return dailyTask.TaskId;
						});

						bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

							convo.sessionEnd = {
								SlackUserId,
								postSessionDecision: false,
								reminders: [],
								completedTaskIds
							};

							askUserPostSessionOptions(err, convo);
							convo.next();

							convo.on('end', (convo) => {

								const { postSessionDecision, reminders, completedTaskIds } = convo.sessionEnd;

								models.Task.update({
									done: true
								}, {
									where: [`"Tasks"."id" in (?)`, completedTaskIds]
								})

								user.getWorkSessions({
									where: [ `"WorkSession"."open" = ?`, true ],
									order: `"createdAt" DESC`
								})
								.then((workSessions) => {
									workSessions.forEach((workSession) => {
										workSession.update({
											open: false
										});
									});
								});

								handlePostSessionDecision(controller, postSessionDecision);

							});
						});
					});
				}
			});
		});
	})

	// `snooze` button flow
	controller.on(`done_session_snooze_button_flow`, (bot, config) => {

		// optionally can get duration if passed in via NL
		const { SlackUserId, botCallback, snoozeTimeObject, remindTimeStampObject } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const { defaultSnoozeTime } = user;

			var snoozeTime = defaultSnoozeTime ? defaultSnoozeTime : TOKI_DEFAULT_SNOOZE_TIME;

			if (botCallback) {
				// if botCallback, need to get the correct bot
				var botToken = bot.config.token;
				bot          = bots[botToken];
			}

			const { SlackUser: { tz } } = user;
			const UserId                = user.id;

			var now               = moment().tz(tz);
			var snoozeTimeObject  = now.add(snoozeTime, 'minutes');

			// CUSTOM NL SNOOZE FROM USER
			if (remindTimeStampObject) {
				snoozeTimeObject  = remindTimeStampObject;
			}

			var snoozeTimeString  = snoozeTimeObject.format("h:mm a");

			models.Reminder.create({
				remindTime: snoozeTimeObject,
				UserId,
				type: "done_session_snooze"
			})
			.then((reminder) => {
				bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

					convo.snoozeObject = {
						defaultSnoozeTime
					}

					if (!defaultSnoozeTime && !remindTimeStampObject) {
						convo.say(`Wait, this is your first time hitting snooze! The default snooze is *${TOKI_DEFAULT_SNOOZE_TIME} minutes*, but you can change it in your settings by telling me to \`show settings\``);
						convo.say("You can also specify a custom snooze by saying `snooze for 20 minutes` or something like that :grinning:");
					}

					convo.say(`I'll check in with you at ${snoozeTimeString} :fist:`);
					convo.next();

					convo.on('end', (convo) => {

						const { defaultSnoozeTime } = convo.snoozeObject

						// set snooze to default snooze if null
						if (!defaultSnoozeTime) {
							user.update({
								defaultSnoozeTime: TOKI_DEFAULT_SNOOZE_TIME
							});
						}
					})
				});
			});
		});
		
	});

	// `no` button flow
	controller.on(`done_session_no_flow`, (bot, config) => {

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

			// making this just a reminder now so that user can end his own session as he pleases
			bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

				convo.sessionEnd = {
					SlackUserId,
					postSessionDecision: false,
					reminders: []
				};

				askUserPostSessionOptions(err, convo);
				convo.next();

				convo.on('end', (convo) => {

					const { postSessionDecision, reminders } = convo.sessionEnd;

					user.getWorkSessions({
						where: [ `"WorkSession"."open" = ?`, true ],
						order: `"createdAt" DESC`
					})
					.then((workSessions) => {
						workSessions.forEach((workSession) => {
							workSession.update({
								open: false
							});
						});
					});

					handlePostSessionDecision(controller, postSessionDecision);

				});
			});
		});
	})

	/**
	 * 			~~ END OF DONE_SESSION TIMER FUNCTIONALITIES ~~
	 */

};