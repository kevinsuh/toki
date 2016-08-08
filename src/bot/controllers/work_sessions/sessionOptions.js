import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { witTimeResponseToTimeZoneObject } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { bots, resumeQueuedReachouts } from '../index';

import { colorsArray, buttonValues, colorsHash, startSessionOptionsAttachments, pausedSessionOptionsAttachments } from '../../lib/constants';

// ALL OF THE TIMEOUT FUNCTIONALITIES
export default function(controller) {


	/**
	 * 			~~ START OF SESSION_OPTIONS FUNCTIONALITIES ~~
	 */

	controller.on(`session_pause_flow`, (bot, config) => {

		const { SlackUserId, botCallback } = config;

		let botToken = bot.config.token;
		bot          = bots[botToken];

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

					workSession.getStoredWorkSession({
						where: [ `"StoredWorkSession"."live" = ?`, true ]
					})
					.then((storedWorkSession) => {

						// GOOD TO PAUSE NOW
						const workSessionId  = workSession.id;
						const endTime        = moment(workSession.endTime);
						const startTime      = moment(workSession.startTime);
						let now              = moment();
						let minutesRemaining = Math.round((moment.duration(endTime.diff(now)).asMinutes() * 100)) / 100; // 2 decimal places

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
							let timeString;
							let message;

							if (storedWorkSession) {

								// already in pause!
								const { minutes } = storedWorkSession.dataValues;
								
								timeString = convertMinutesToHoursString(minutes);
								message    = `Wait, your session is already on pause! You have *${timeString}* remaining for ${tasksToWorkOnString}`

							} else {

								/**
								 * 		~~ GOOD TO GO TO PAUSE SESSION! ~~
								 * 			add minutes to count when pausing
								 * 		since you are creating new workSession each time
								 */
								
								let workSessionMinutes = Math.round(moment.duration(now.diff(startTime)).asMinutes());

								let dailyTask    = dailyTasks[0];
								if (!dailyTask){
									// FAILURE FAILURE SHOULD NEVER HAPPEN
									// (this means no dailyTask attached to workSession)
									return;
								}
								let minutesSpent = dailyTask.minutesSpent;
								minutesSpent     += workSessionMinutes;

								dailyTask.update({
									minutesSpent
								});

								workSession.update({
									endTime: now,
									live: false
								});

								models.StoredWorkSession.create({
									WorkSessionId: workSessionId,
									minutes: minutesRemaining
								});

								timeString = convertMinutesToHoursString(minutesRemaining);
								let workSessionTimeString = convertMinutesToHoursString(workSessionMinutes);
								message    = `Your session is paused :double_vertical_bar:. You've worked for ${workSessionTimeString} towards \`${tasksToWorkOnString}\` and have *${timeString} remaining* in this session`;

							}
							// making this just a reminder now so that user can end his own session as he pleases
							bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

								convo.say({
									text: message,
									attachments: pausedSessionOptionsAttachments
								});

								convo.next();

								convo.on('end', (convo) => {
									resumeQueuedReachouts(bot, { SlackUserId });
								});

							});
						})
					})

				} else {
					notInSessionWouldYouLikeToStartOne({ bot, controller, SlackUserId });
				}

			});
		})
	});

	controller.on(`session_resume_flow`, (bot, config) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const { SlackUserId, botCallback } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;
			const { SlackUser: { tz } } = user;

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

						workSession.getDailyTasks({
							include: [ models.Task ],
							where: [`"DailyTask"."type" = ?`, "live"]
						})
						.then((dailyTasks) => {

							if (dailyTasks.length > 0) {

								// we are in the clear to resume the session!
								let dailyTaskIds = [];
								dailyTasks.forEach((dailyTask) => {
									dailyTaskIds.push(dailyTask.dataValues.id);
								});

								const now = moment();

								let tasksToWorkOnTexts = dailyTasks.map((dailyTask) => {
									if (dailyTask.dataValues) {
										return dailyTask.dataValues.Task.text;
									} else {
										return dailyTask.text;
									}
								});

								let tasksString     = commaSeparateOutTaskArray(tasksToWorkOnTexts);
								let timeString;
								let endTime;
								let endTimeString;

								if (storedWorkSession) {
									// existing paused session to resume
									
									const { minutes } = storedWorkSession;
									endTime           = now.add(minutes, 'minutes').tz(tz);
									endTimeString     = endTime.format("h:mm a");
									timeString        = convertMinutesToHoursString(minutes);
									
									workSession.update({
										open: false
									});

									// create new work session with those daily tasks
									models.WorkSession.create({
										startTime: moment(),
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

										bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
											convo.say({
												text: `Resumed :arrow_forward:! Good luck with \`${tasksString}\`!\n\nSee you in ${timeString} at *${endTimeString}* :timer_clock:`,
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

									// no paused sessions: either in live one or not in one!
									if (workSession.dataValues.open) {

										endTime              = moment(workSession.dataValues.endTime).tz(tz);
										endTimeString        = endTime.format("h:mm a");
										let minutesRemaining = moment.duration(endTime.diff(now)).asMinutes();
										timeString           = convertMinutesToHoursString(minutesRemaining);

										bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
											convo.say(`Wait, your session has already been resumed! You have ${timeString} remaining for ${tasksString}`);
											convo.say({
												text: `See you at *${endTimeString}*  :timer_clock:`,
												attachments: startSessionOptionsAttachments
											});
											convo.next();
											convo.on('end', (convo) => {
												setTimeout(() => {
													resumeQueuedReachouts(bot, { SlackUserId });
												}, 500);	
											});
										});

									} else {
										notInSessionWouldYouLikeToStartOne({ bot, controller, SlackUserId });
									}
									
								}

							} else {
								notInSessionWouldYouLikeToStartOne({ bot, controller, SlackUserId });
							}

						});
					});

				} else {
					notInSessionWouldYouLikeToStartOne({ bot, controller, SlackUserId });
				}

			});
		});
	});

	controller.on(`session_add_checkin_flow`, (bot, config) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const { SlackUser: { tz } } = user;
			const UserId                = user.id;

			user.getWorkSessions({
				where: [`"WorkSession"."open" = ?`, true],
				order: `"WorkSession"."createdAt" DESC`,
				limit: 1
			})
			.then((workSessions) => {

				if (workSessions.length > 0) {

					bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

						convo.say(`Let's add a checkin!`);
						convo.next();

						convo.on('end', (convo) => {

							let config           = { SlackUserId };
							config.reminder_type = "work_session";
							controller.trigger(`ask_for_reminder`, [bot, config]);
							
							resumeQueuedReachouts(bot, { SlackUserId });
							
						});
					});

				} else {
					notInSessionWouldYouLikeToStartOne({ bot, controller, SlackUserId });
				}

			});
		});
	})

};

export function notInSessionWouldYouLikeToStartOne(config) {
	const { bot, SlackUserId, controller } = config;
	if (bot && SlackUserId && controller) {
		bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
			convo.ask(`You're not in a session right now! Would you like to start one?`, [
				{
					pattern: utterances.yes,
					callback: (response, convo) => {
						convo.startSession = true;
						convo.next();
					}
				},
				{
					pattern: utterances.no,
					callback: (response, convo) => {
						convo.say("Okay! I'll be here when you want to `start a session` :smile_cat:");
						convo.next();
					}
				},
				{
					default: true,
					callback: (response, convo) => {
						convo.say("Sorry, I didn't catch that");
						convo.repeat();
						convo.next();
					}
				}
			]);
			convo.next();
			convo.on('end', (convo) => {
				if (convo.startSession) {
					controller.trigger(`begin_session`, [ bot, { SlackUserId } ]);
				}
				setTimeout(() => {
					resumeQueuedReachouts(bot, { SlackUserId });
				}, 500);	
			});
		});
	}
}