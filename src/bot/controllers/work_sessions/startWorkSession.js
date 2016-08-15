import os from 'os';
import { wit, bots } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertMinutesToHoursString, convertStringToNumbersArray } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, closeOldRemindersAndSessions } from '../../lib/miscHelpers';

import intentConfig from '../../lib/intents';
import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, startSessionOptionsAttachments, constants } from '../../lib/constants';

import { resumeQueuedReachouts } from '../index';

import { finalizeTimeAndTasksToStart, startSessionWithConvoObject } from '../modules/startWorkSessionFunctions';

// START OF A WORK SESSION
export default function(controller) {

	/**
	 *
	 * 		User directly asks to start a session
	 * 							~* via Wit *~
	 * 		     this makes sure you are properly in
	 * 		     				in a "SessionGroup" before
	 * 		     			working on your session
	 */
	controller.hears(['start_session', 'is_back'], 'direct_message', wit.hears, (bot, message) => {

		const { intentObject: { entities: { intent } } } = message;
		let sessionIntent;
		if (intent && intent.length > 0) {
			sessionIntent = intent[0].value;
		}

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;
		const { text }    = message;

		let config = {
			planDecision: constants.PLAN_DECISION.work.word,
			SlackUserId,
			message
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});

		let taskNumbers = convertStringToNumbersArray(text);
		if (taskNumbers) {
			config.taskNumbers = taskNumbers;
			controller.trigger(`edit_plan_flow`, [ bot, config ]);
		} else {
			setTimeout(() => {
				models.User.find({
					where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
					include: [ models.SlackUser ]
				}).then((user) => {

					const name = user.nickName || user.email;

					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
						if (sessionIntent == 'is_back') {
							convo.say(`Welcome back, ${name}!`);
						} else {
							convo.say(" ");
						}
						convo.next();
						convo.on('end', (convo) => {
							// new session we'll automatically send to begin_session now
							controller.trigger(`begin_session`, [ bot, config ]);
						})
					});

				});
			}, 750);
		}

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

		const { SlackUserId, dailyTaskToWorkOn, currentSession } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [ models.SlackUser ]
		}).then((user) => {

			// need user's timezone for this flow!
			const { SlackUser: { tz } } = user;
			const UserId = user.id;

			if (!tz) {
				bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
					convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
				});
				return;
			}

			user.getDailyTasks({
				where: [`"DailyTask"."type" = ?`, "live"],
				include: [ models.Task ],
				order: `"Task"."done", "DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {

				dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					convo.sessionStart = {
						SlackUserId,
						UserId,
						tz,
						bot,
						dailyTasks
					}

					if (dailyTaskToWorkOn) {
						convo.sessionStart.dailyTask = dailyTaskToWorkOn;
					} else if (dailyTasks.length > 0) { // otherwise it will be the first daily task
						convo.sessionStart.dailyTask = dailyTasks[0];
					}

					// check for openWorkSession, before starting flow
					user.getWorkSessions({
						where: [`"open" = ?`, true]
					})
					.then((workSessions) => {

						let currentSession = false;

						if (workSessions.length > 0) {

							let openWorkSession = workSessions[0];
							openWorkSession.getStoredWorkSession({
								where: [ `"StoredWorkSession"."live" = ?`, true ]
							})
							.then((storedWorkSession) => {
								openWorkSession.getDailyTasks({
									include: [ models.Task ]
								})
								.then((dailyTasks) => {

									// if there is an already open session we will store it
									// and if it is paused

									let now           = moment();
									let endTime       = moment(openWorkSession.endTime);
									let endTimeString = endTime.format("h:mm a");
									let minutes       = Math.round(moment.duration(endTime.diff(now)).asMinutes());
									var minutesString = convertMinutesToHoursString(minutes);

									let dailyTaskTexts = dailyTasks.map((dailyTask) => {
										return dailyTask.dataValues.Task.text;
									});

									let sessionTasks = commaSeparateOutTaskArray(dailyTaskTexts);

									currentSession = {
										minutes,
										minutesString,
										sessionTasks,
										endTimeString,
										storedWorkSession
									}

									if (storedWorkSession) {
										currentSession.isPaused = true;

										minutes       = Math.round(storedWorkSession.dataValues.minutes);
										minutesString = convertMinutesToHoursString(minutes);

										currentSession.minutes       = minutes;
										currentSession.minutesString = minutesString;

									}

									console.log(currentSession);

									convo.sessionStart.currentSession = currentSession;
									finalizeTimeAndTasksToStart(convo);
									convo.next();

								});
							});

						} else {
							convo.sessionStart.currentSession = currentSession;
							finalizeTimeAndTasksToStart(convo);
							convo.next();
						}

					});

					convo.on('end', (convo) => {

						const { sessionStart, sessionStart: { dailyTask, completeDailyTask, confirmStart, confirmOverRideSession, addMinutesToDailyTask, endDay } } = convo;

						console.log("\n\n\n end of start session ");
						console.log(sessionStart);
						console.log("\n\n\n");

						if (completeDailyTask) {
							// complete current priority and restart `begin_session`
							
							closeOldRemindersAndSessions(user);
							const TaskId = dailyTask.dataValues.Task.id;
							models.Task.update({
								done: true
							}, {
								where: [`"Tasks"."id" = ?`, TaskId]
							})
							.then(() => {
								controller.trigger(`begin_session`, [bot, { SlackUserId }]);
							});

						} else if (addMinutesToDailyTask) {
							// add minutes to current priority and restart `begin_session`
							
							const { id, minutesSpent} = dailyTask.dataValues;
							const minutes = minutesSpent + addMinutesToDailyTask;
							models.DailyTask.update({
								minutes
							}, {
								where: [`"DailyTasks"."id" = ?`, id]
							})
							.then(() => {
								controller.trigger(`begin_session`, [bot, { SlackUserId }]);
							})

						} else if (confirmOverRideSession) {
							// cancel current session and restart `begin_session`
							closeOldRemindersAndSessions(user);
							setTimeout(() => {
								controller.trigger(`begin_session`, [bot, { SlackUserId, dailyTaskToWorkOn: dailyTask }]);
							}, 700)
						} else if (sessionStart.endDay) {
							// this should rarely ever, ever happen. (i.e. NEVER)
							closeOldRemindersAndSessions(user);
							setTimeout(() => {
								controller.trigger(`confirm_end_plan`, [bot, { SlackUserId }]);
							}, 700)

						} else if (confirmStart) {
							// start the session!
							closeOldRemindersAndSessions(user);
							setTimeout(() => {
								startSessionWithConvoObject(convo.sessionStart);
							}, 500);
						} else {
							setTimeout(() => {
								resumeQueuedReachouts(bot, { SlackUserId });
							}, 750);
						}

					})
				
				});
			});

		});
	});

}

