import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, convertMinutesToHoursString } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

import { bots, resumeQueuedReachouts } from '../index';

import { colorsArray, buttonValues, colorsHash, startSessionOptionsAttachments } from '../../lib/constants';

// ALL OF THE TIMEOUT FUNCTIONALITIES
export default function(controller) {


	/**
	 * 			~~ START OF SESSION_OPTIONS FUNCTIONALITIES ~~
	 */

	controller.on(`session_pause_flow`, (bot, config) => {

		const { SlackUserId, botCallback } = config;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			let botToken = bot.config.token;
			bot          = bots[botToken];
		}

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

				// end most recent work session, and create new storedWorkSession
				// with the remaining minutes
				if (workSessions.length > 0) {
					
					const workSession    = workSessions[0];
					const workSessionId  = workSession.id;
					const endTime        = moment(workSession.endTime);
					let now              = moment();
					let minutesRemaining = Math.round((moment.duration(endTime.diff(now)).asMinutes() * 100)) / 100; // 2 decimal places

					workSession.update({
						endTime: now,
						live: false
					});

					models.StoredWorkSession.create({
						WorkSessionId: workSessionId,
						minutes: minutesRemaining
					});

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

							let timeString = convertMinutesToHoursString(minutesRemaining);

							convo.say({
								text: `I've paused your session. You have *${timeString}* remaining for ${tasksToWorkOnString}`,
								attachments: [
									{
										attachment_type: 'default',
										callback_id: "PAUSED_SESSION_OPTIONS",
										fallback: "Your session is paused!",
										actions: [
											{
													name: buttonValues.startSession.resume.name,
													text: "Resume",
													value: buttonValues.startSession.resume.value,
													type: "button",
													style: "primary"
											},
											{
													name: buttonValues.startSession.pause.endEarly.name,
													text: "End Session",
													value: buttonValues.startSession.pause.endEarly.value,
													type: "button"
											}
										]
									}
								]
							});

							convo.next();

							convo.on('end', (convo) => {
								resumeQueuedReachouts(bot, { SlackUserId });
							});

						});
					})
				} else {
					// 1. already has been paused
					
					// 2. has been closed now

					// no open sessions to pause
					bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
						convo.say(`Doesn't look like you have an open session :thinking_face:. Let me know if you want to start a new one!`);
						convo.next();
						convo.on('end', (convo) => {
							setTimeout(() => {
								resumeQueuedReachouts(bot, { SlackUserId });
							}, 500);	
						});
					});
				}
			})
		})
	});

	controller.on(`session_resume_flow`, (bot, config) => {

		const { SlackUserId, botCallback } = config;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			let botToken = bot.config.token;
			bot          = bots[botToken];
		}

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;

			// get THE most recently created workSession for that user
			user.getWorkSessions({
				order: `"WorkSession"."createdAt" DESC`,
				limit: 1
			})
			.then((workSessions) => {

				if (workSessions.length > 0) {

					let workSession = workSessions[0];
					workSession.getStoredWorkSession({
						where: [ `"StoredWorkSession"."live" = ?`, true ]
					})
					.then((storedWorkSession) => {
						if (storedWorkSession) {
							// it has been paused
							// now check if there are daily tasks associated
							workSession.getDailyTasks({
								include: [ models.Task ],
								where: [`"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live"]
							})
							.then((dailyTasks) => {
								if (dailyTasks.length > 0) {
									// we are in the clear to resume the session!
									let dailyTaskIds = [];
									dailyTasks.forEach((dailyTask) => {
										dailyTaskIds.push(dailyTask.dataValues.id);
									});

									const { minutes } = storedWorkSession;

									const now = moment();
									const endTime = now.add(minutes, 'minutes');

									// end prev work session
									workSession.update({
										open: false
									});

									// create new work session with those daily tasks
									models.WorkSession.create({
										startTime: now,
										endTime,
										UserId,
										live: true
									})
									.then((workSession) => {

										// add new daily tasks to the workSession
										workSession.setDailyTasks(dailyTaskIds);

										/**
										 * 		~~ RESUME WORK SESSION MESSAGE ~~
										 */

										let tasksToWorkOnTexts = dailyTasks.map((dailyTask) => {
											if (dailyTask.dataValues) {
												return dailyTask.dataValues.Task.text;
											} else {
												return dailyTask.text;
											}
										});

										let tasksString     = commaSeparateOutTaskArray(tasksToWorkOnTexts);
										let timeString      = convertMinutesToHoursString(minutes);
										let endTimeString   = endTime.format("h:mm a");

										bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
											convo.say(`I've resumed your session!`)
											convo.say({
												text: `Good luck with ${tasksString}!\nSee you in ${timeString} at *${endTimeString}* :timer_clock:`,
												attachments: startSessionOptionsAttachments
											});
											convo.next();
											convo.on('end', (convo) => {
												setTimeout(() => {
													resumeQueuedReachouts(bot, { SlackUserId });
												}, 500);	
											});
										});

									});
								} else {
									// no live and open tasks
									bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
										convo.say(`You don't have any tasks left for this session! Let me know when you want to \`start a session\``);
										convo.next();
										convo.on('end', (convo) => {
											resumeQueuedReachouts(bot, { SlackUserId });
										});
									});
								}
							})
						} else {
							// it has NOT been paused yet
							bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
								convo.say(`Doesn't seem like you paused this session :thinking_face:. Let me know if you want to \`start a session\``);
								convo.next();
								convo.on('end', (convo) => {
									console.log(`\n\n\n ~~ should resume aslfkamsflmk ~~ \n\n`);
									setTimeout(() => {
										resumeQueuedReachouts(bot, { SlackUserId });
									}, 500);	
								});
							});
						}
					});

				}
			});
		});
	});

	controller.on(`session_add_checkin_flow`, (bot, config) => {

		const { SlackUserId, botCallback } = config;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot          = bots[botToken];
		}

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			var { defaultBreakTime } = user;

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
								resumeQueuedReachouts(bot, { SlackUserId });
							});
						});
					});
				}
			});
		});
	})

	controller.on(`session_end_early_flow`, (bot, config) => {

		const { SlackUserId, botCallback, storedWorkSession } = config;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot          = bots[botToken];
		}

		controller.trigger(`done_session_flow`, [bot, config]);

	});

};