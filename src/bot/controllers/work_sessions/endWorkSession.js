import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, convertMinutesToHoursString, deleteConvoAskMessage, deleteMostRecentDoneSessionMessage } from '../../lib/messageHelpers';
import { closeOldRemindersAndSessions, witTimeResponseToTimeZoneObject, prioritizeDailyTasks } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { bots, resumeQueuedReachouts } from '../index';

import { colorsArray, buttonValues, colorsHash, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME, sessionTimerDecisions, MINUTES_FOR_DONE_SESSION_TIMEOUT, pausedSessionOptionsAttachments, startSessionOptionsAttachments, TASK_DECISION } from '../../lib/constants';

// END OF A WORK SESSION
export default function(controller) {


	// User explicitly wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', wit.hears, (bot, message) => {

		/**
		 * 			check if user has open session (should only be one)
		 * 					if yes, trigger finish and end_session flow
		 * 			  	if no, reply with confusion & other options
		 */
		
		const SlackUserId = message.user;

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
			if (utterances.containsTask.test(message.text)) {
				// want to finish off some tasks
				controller.trigger(`edit_tasks_flow`, [bot, { SlackUserId }]);
			} else {
				controller.trigger(`done_session_flow`, [bot, { SlackUserId }]);
			}
		}, 800);
	});

	controller.on('done_session_flow', (bot, config) => {

		// you can pass in a storedWorkSession
		const { SlackUserId, storedWorkSession } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {
			user.getWorkSessions({
				where: [ `"open" = ?`, true ],
				order: `"WorkSession"."createdAt" DESC`,
				include: [ models.DailyTask ]
			})
			.then((workSessions) => {

				const UserId = user.id;
				let workSession = storedWorkSession || workSessions[0];

				// if live work session, confirm end early
				// else, user MUST say `done` to trigger end (this properly simulates user is done with that session)
				if (workSession) {

					workSession.getStoredWorkSession({
						where: [ `"StoredWorkSession"."live" = ?`, true ]
					})
					.then((storedWorkSession) => {

						var dailyTaskIds = workSession.DailyTasks.map((dailyTask) => {
							return dailyTask.id;
						});

						user.getDailyTasks({
							where: [ `"DailyTask"."id" IN (?) AND "Task"."done" = ?`, dailyTaskIds, false ],
							include: [ models.Task ]
						})
						.then((dailyTasks) => {

							let taskTextsToWorkOnArray = dailyTasks.map((dailyTask) => {
								let text = dailyTask.Task.dataValues.text;
								return text;
							});
							let tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

							bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

								const { SlackUser: { tz }, defaultBreakTime } = user;

								convo.doneSessionEarly = {
									SlackUserId,
									dailyTaskIds,
									workSession,
									doneEarlyDecision: false
								}

								convo.sessionEnd = {
									UserId: user.id,
									tz,
									postSessionDecision: false,
									reminders: [],
									tasksCompleted: [],
									SlackUserId,
									defaultBreakTime
								}

								// get times for user
								let now           = moment();
								let endTime       = moment(workSession.dataValues.endTime).tz(tz);
								let endTimeString = endTime.format("h:mm a");
								let minutes       = moment.duration(endTime.diff(now)).asMinutes();
								let minutesString = convertMinutesToHoursString(minutes);

								convo.doneSessionEarly.currentSession = {
									minutesString,
									endTimeString,
									tasksToWorkOnString
								}

								if (storedWorkSession) {
									minutes       = storedWorkSession.dataValues.minutes;
									minutesString = convertMinutesToHoursString(minutes);
									// currently paused
									convo.doneSessionEarly.currentSession.isPaused = true;
									convo.doneSessionEarly.currentSession.minutesString = minutesString;
								}

								let message = ``;
								if (dailyTasks.length == 0) {
									message = `Did you finish your tasks for this session?`;
								} else {
									message = `Did you finish ${tasksToWorkOnString}?`
								}

								convo.ask({
									text: message,
									attachments:[
										{
											attachment_type: 'default',
											callback_id: "DONE_SESSION",
											fallback: "Are you done with your session?",
											actions: [
												{
														name: buttonValues.doneSessionYes.name,
														text: "Yes! :punch:",
														value: buttonValues.doneSessionYes.value,
														type: "button",
														style: "primary"
												},
												{
														name: buttonValues.doneSessionDidSomethingElse.name,
														text: "Did something else",
														value: buttonValues.doneSessionDidSomethingElse.value,
														type: "button"
												},
												{
														name: buttonValues.cancelSession.name,
														text: "Nope",
														value: buttonValues.cancelSession.value,
														type: "button"
												},
												{
														name: buttonValues.doneSessionEarlyNo.name,
														text: "Continue session",
														value: buttonValues.doneSessionEarlyNo.value,
														type: "button"
												}
											]
										}
									]
								},
								[
									{
										pattern: buttonValues.doneSessionYes.value,
										callback: function(response, convo) {
											convo.doneSessionEarly.doneEarlyDecision = sessionTimerDecisions.didTask;
											askUserPostSessionOptions(response, convo);
											convo.next();
										}
									},
									{ // same as buttonValues.doneSessionYes.value
										pattern: utterances.yes,
										callback: (response, convo) => {

											// delete button when answered with NL
											deleteConvoAskMessage(response.channel, bot);

											convo.say("Great work :raised_hands:");
											convo.doneSessionEarly.doneEarlyDecision = sessionTimerDecisions.didTask;
											askUserPostSessionOptions(response, convo);
											convo.next();
										}
									},
									{ // this just triggers `end_session` flow
										pattern: buttonValues.doneSessionDidSomethingElse.value,
										callback: (response, convo) => {
											convo.doneSessionEarly.doneEarlyDecision = sessionTimerDecisions.didSomethingElse;
											convo.next();
										}
									},
									{ // same as buttonValues.doneSessionDidSomethingElse.value
										pattern: utterances.containsElse,
										callback: (response, convo) => {

											// delete button when answered with NL
											deleteConvoAskMessage(response.channel, bot);

											convo.doneSessionEarly.doneEarlyDecision = sessionTimerDecisions.didSomethingElse;
											convo.say(`:ocean: Woo!`);
											convo.next();
										}
									},
									{ // continue session
										pattern: buttonValues.doneSessionEarlyNo.value,
										callback: (response, convo) => {

											const { doneSessionEarly: { currentSession } } = convo;
											const { minutesString, tasksToWorkOnString, endTimeString } = currentSession;

											if (currentSession.isPaused) {
												// paused session
												convo.say({
													text: `Let me know when you want to resume your session for ${tasksToWorkOnString}!`,
													attachments: pausedSessionOptionsAttachments
												});
											} else {
												// live session
												convo.say({
													text: `Good luck with ${tasksToWorkOnString}! See you at *${endTimeString}* :timer_clock:`,
													attachments: startSessionOptionsAttachments
												});
											}
											convo.next();
										}
									},
									{ // same as buttonValues.doneSessionNo.value
										pattern: utterances.containsContinue,
										callback: (response, convo) => {

											// delete button when answered with NL
											deleteConvoAskMessage(response.channel, bot);

											convo.say(`Got it`);
											convo.say(`I'll see you in ${minutesString} at *${endTimeString}*! Keep crushing :muscle:`);
											convo.next();
										}
									},
									{
										pattern: buttonValues.cancelSession.value,
										callback: (response, convo) => {
											convo.doneSessionEarly.doneEarlyDecision = sessionTimerDecisions.cancelSession;
											askUserPostSessionOptions(response, convo);
											convo.next();
										}
									},
									{ // same as buttonValues.cancelSession.value
										pattern: utterances.no,
										callback: (response, convo) => {

											// delete button when answered with NL
											deleteConvoAskMessage(response.channel, bot);

											convo.doneSessionEarly.doneEarlyDecision = sessionTimerDecisions.cancelSession;
											convo.say("No worries! We'll get that done soon");
											askUserPostSessionOptions(response, convo);
											convo.next();
										}
									},
									{ // this is failure point. restart with question
										default: true,
										callback: function(response, convo) {
											convo.say("I didn't quite get that :thinking_face:");
											convo.repeat();
											convo.next();
										}
									}
								]);
								convo.next();

								/**
								 * 		~~ END OF THIS CONVO ~~
								 */

								convo.on('end', (convo) => {

									const { SlackUserId, dailyTaskIds, doneEarlyDecision } = convo.doneSessionEarly;
									const { postSessionDecision, reminders } = convo.sessionEnd;

									if (doneEarlyDecision) {

										closeOldRemindersAndSessions(user);

										switch (doneEarlyDecision) {
											case sessionTimerDecisions.didTask:
												// update the specific task finished
												user.getDailyTasks({
													where: [ `"DailyTask"."id" IN (?)`, dailyTaskIds ],
													include: [ models.Task ]
												})
												.then((dailyTasks) => {
													var completedTaskIds = dailyTasks.map((dailyTask) => {
														return dailyTask.TaskId;
													});
													models.Task.update({
														done: true
													}, {
														where: [`"Tasks"."id" in (?)`, completedTaskIds]
													})
													.then(() => {
														prioritizeDailyTasks(user);
													})
												});
												break;
											case sessionTimerDecisions.didSomethingElse:
												controller.trigger(`end_session`, [ bot, { SlackUserId }])
												return;
											case sessionTimerDecisions.cancelSession:
												break;
											case sessionTimerDecisions.newSession:
												controller.trigger(`begin_session`, [ bot, { SlackUserId }]);
												return;
											default: break;
										}

										/**
										 * 		~~ THIS IS SIMULATION OF `session_end` FLOW
										 * 		essentially figuring out postSessionDecision
										 */

										// then from here, active the postSessionDecisions
										setTimeout(() => { 
											handlePostSessionDecision(postSessionDecision, { controller, bot, SlackUserId });
										}, 500);

										// set reminders (usually a break)
										reminders.forEach((reminder) => {
											const { remindTime, customNote, type } = reminder;
											models.Reminder.create({
												UserId,
												remindTime,
												customNote,
												type
											});
										});
									} else {
										resumeQueuedReachouts(bot, { SlackUserId });
									}

								});
							});

						});

					});

				} else {

					// want to be end a session when they arent currently in one
					bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
						convo.ask(`You aren't in a session right now! Would you like to start one?`, [
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
									convo.say(`Okay! I'll be here when you're ready to crank again :wrench: `);
									convo.next();
								}
							},
							{
								default: true,
								callback: (response, convo) => {
									convo.say("Sorry, I didn't get that. Please tell me `yes` or `no` to the question!");
									convo.repeat();
									convo.next();
								}
							}
						]);
						convo.next();
						convo.on('end', (convo) => {
							if (convo.startSession) {
								controller.trigger('confirm_new_session', [bot, { SlackUserId }]);
							} else {
								resumeQueuedReachouts(bot, { SlackUserId });
							}
						});
					});
					
				}
			});
		})
	});


	/**
	 * 			~~ START OF SESSION_TIMER FUNCTIONALITIES ~~
	 */


	// session timer is up AND IN CONVO.ASK FLOW!
	controller.on('session_timer_up', (bot, config) => {

		/**
		 * 		Timer is up. Give user option to extend session or start reflection
		 */

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

			const { defaultSnoozeTime, defaultBreakTime } = user;

			user.getDailyTasks({
				where: [ `"DailyTask"."id" IN (?) AND "Task"."done" = ?`, dailyTaskIds, false ],
				include: [ models.Task ]
			})
			.then((dailyTasks) => {

				// cancel all old reminders
				user.getReminders({
					where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break", "done_session_snooze"] ]
				}).
				then((oldReminders) => {
					oldReminders.forEach((reminder) => {
						reminder.update({
							"open": false
						})
					});
				});

				var taskTextsToWorkOnArray = dailyTasks.map((dailyTask) => {
					var text = dailyTask.Task.dataValues.text;
					return text;
				});
				var tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

				// making this just a reminder now so that user can end his own session as he pleases
				bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

					const { source_message } = convo;

					convo.doneSessionTimerObject = {
						SlackUserId,
						sessionTimerDecision: false,
						dailyTaskIds
					}

					const { SlackUser: { tz } } = user;

					convo.sessionEnd = {
						UserId: user.id,
						tz,
						postSessionDecision: false,
						reminders: [],
						tasksCompleted: [],
						SlackUserId,
						defaultBreakTime,
						defaultSnoozeTime
					}

					if (source_message) {
						convo.doneSessionTimerObject.channel = source_message.channel;
						convo.sessionEnd.channel = source_message.channel;
					}

					var timeOutMinutes = 1000 * 60 * MINUTES_FOR_DONE_SESSION_TIMEOUT;

					setTimeout(() => {
						convo.doneSessionTimerObject.timeOut = true;
						convo.stop();
					}, timeOutMinutes);

					var message = ``;
					if (dailyTasks.length == 0) {
						message = `Hey, did you finish your tasks for this session?`;
					} else {
						message = `Hey, did you finish ${tasksToWorkOnString}?`
					}

					var extendSessionText = defaultSnoozeTime ? `Extend by ${defaultSnoozeTime} min` : `Extend Session`;
					extendSessionText = `${extendSessionText} :timer_clock:`;

					convo.ask({
						text: message,
						attachments:[
							{
								attachment_type: 'default',
								callback_id: "DONE_SESSION",
								fallback: "Did you finish your session?",
								actions: [
									{
											name: buttonValues.doneSessionYes.name,
											text: "Yes! :punch:",
											value: buttonValues.doneSessionYes.value,
											type: "button",
											style: "primary"
									},
									{
											name: buttonValues.doneSessionSnooze.name,
											text: extendSessionText,
											value: buttonValues.doneSessionSnooze.value,
											type: "button"
									},
									{
											name: buttonValues.doneSessionDidSomethingElse.name,
											text: "Did something else",
											value: buttonValues.doneSessionDidSomethingElse.value,
											type: "button"
									},
									{
											name: buttonValues.doneSessionNo.name,
											text: "Nope",
											value: buttonValues.doneSessionNo.value,
											type: "button"
									}
								]
							}
						]
					},
					[
						{
							pattern: buttonValues.doneSessionYes.value,
							callback: function(response, convo) {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.didTask;
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{ // same as buttonValues.doneSessionYes.value
							pattern: utterances.yes,
							callback: (response, convo) => {

								// delete button when answered with NL
								deleteConvoAskMessage(response.channel, bot);

								convo.say("Great work :raised_hands:");
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.didTask;
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{
							pattern: buttonValues.doneSessionSnooze.value,
							callback: (response, convo) => {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.snooze;
								convo.next();
							}
						},
						{ // same as buttonValues.doneSessionSnooze.value
							pattern: utterances.containsSnooze,
							callback: (response, convo) => {

								// delete button when answered with NL
								deleteConvoAskMessage(response.channel, bot);

								convo.say(`Keep at it!`);
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.snooze;
								
								// wit will pick up duration here
								const { text, intentObject: { entities: { duration } } } = response;
								convo.doneSessionTimerObject.customSnooze = {
									text,
									duration
								};

								convo.next();
							}
						},
						{ // this just triggers `end_session` flow
							pattern: buttonValues.doneSessionDidSomethingElse.value,
							callback: (response, convo) => {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.didSomethingElse;
								convo.next();
							}
						},
						{ // same as buttonValues.doneSessionDidSomethingElse.value
							pattern: utterances.containsElse,
							callback: (response, convo) => {

								// delete button when answered with NL
								deleteConvoAskMessage(response.channel, bot);

								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.didSomethingElse;
								convo.say(`:ocean: Woo!`);
								convo.next();
							}
						},
						{
							pattern: buttonValues.doneSessionNo.value,
							callback: (response, convo) => {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.noTasks;
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{ // same as buttonValues.doneSessionNo.value
							pattern: utterances.no,
							callback: (response, convo) => {

								// delete button when answered with NL
								deleteConvoAskMessage(response.channel, bot);

								convo.say(`That's okay! You can keep chipping away and you'll get there :pick:`);
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.noTasks;
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{ // this is failure point. restart with question
							default: true,
							callback: function(response, convo) {

								// wit will pick up duration here
								const { text, intentObject: { entities: { duration } } } = response;
								if (duration) {
									// allow extend if they just put time
									convo.doneSessionTimerObject.customSnooze = {
										text,
										duration
									};
									// delete button when answered with NL
									deleteConvoAskMessage(response.channel, bot);

									convo.say(`Keep at it!`);
									convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.snooze;
								} else {
									// otherwise we're confused
									convo.say("I didn't quite get that :thinking_face:");
									convo.repeat();
								}

								convo.next();
								
							}
						}
					]);
					convo.next();

					convo.on('end', (convo) => {

						const { sessionEnd: { postSessionDecision, reminders }, doneSessionTimerObject: { dailyTaskIds, timeOut, SlackUserId, sessionTimerDecision, customSnooze, channel } } = convo;

						models.User.find({
							where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
							include: [
								models.SlackUser
							]
						})
						.then((user) => {

							if (timeOut) {

								// this "timeout" message only gets sent if this specific convo still has an open work session and no snooze attached. this means that user has gone AFK. if there is a snooze, another `done_session_timer` will trigger in 9 minutes and will be handle the ending of the work session
								
								// open sessions that were ENDED < 29.5 minutes ago
								var minutes = MINUTES_FOR_DONE_SESSION_TIMEOUT - 0.5;
								var timeOutMinutesAgo = moment().subtract(minutes, 'minutes').format("YYYY-MM-DD HH:mm:ss Z");
								user.getWorkSessions({
									where: [`"WorkSession"."open" = ? AND "WorkSession"."endTime" < ?`, true, timeOutMinutesAgo],
									order: `"WorkSession"."createdAt" DESC`
								})
								.then((workSessions) => {
									// only if there are still "open" work sessions
									// this means the user has not closed it in 30 minutes
									if (workSessions.length > 0) {

										deleteMostRecentDoneSessionMessage(channel, bot);

										// this was a 30 minute timeout for done_session timer!
										controller.trigger(`done_session_timeout_flow`, [ bot, { SlackUserId, workSession }])
										
									};
								});
							} else {

								convo.doneSessionTimerObject.timeOut = false;

								// NORMAL FLOW
								const UserId = user.id;

								switch (sessionTimerDecision) {
									case sessionTimerDecisions.didTask:
										// update the specific task finished
										user.getDailyTasks({
											where: [ `"DailyTask"."id" IN (?)`, dailyTaskIds ],
											include: [ models.Task ]
										})
										.then((dailyTasks) => {
											var completedTaskIds = dailyTasks.map((dailyTask) => {
			    							return dailyTask.TaskId;
			    						});
			    						models.Task.update({
			    							done: true
			    						}, {
			    							where: [`"Tasks"."id" in (?)`, completedTaskIds]
			    						})
			    						.then(() => {
			    							prioritizeDailyTasks(user);
			    						})
										});
										break;
									case sessionTimerDecisions.snooze:

										if (customSnooze) {

											const { text, duration } = customSnooze;

											// user only said `snooze` or `extend`
											if (utterances.onlyContainsSnooze.test(text) || utterances.onlyContainsExtend.test(text)) {
												// automatically do default snooze here then
												controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId }]);
											} else {
												// user said `snooze for X minutes`
												controller.trigger(`snooze_reminder_flow`, [ bot, { SlackUserId, duration } ]);
											}

										} else {
											// button triggered it (do default)
											controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId }]);
										}
											
										return;
									case sessionTimerDecisions.didSomethingElse:
										controller.trigger(`end_session`, [ bot, { SlackUserId }])
										return;
									case sessionTimerDecisions.noTasks:
										// nothing
										break;
									default: break;
								}

								/**
								 * 		~~ THIS IS SIMULATION OF `session_end` FLOW
								 * 		essentially figuring out postSessionDecision
								 */
								
								// end all OPEN work sessions here, because user
								// ~~ CLOSING a work session MUST ALSO MAKE IT NOT LIVE!! ~~
								// has decided to PROACTIVELY CLOSE IT
								user.getWorkSessions({
									where: [ `"WorkSession"."open" = ?`, true ],
									order: `"createdAt" DESC`
								})
								.then((workSessions) => {
									workSessions.forEach((workSession) => {
										workSession.update({
											open: false,
											live: false
										});
									});

									// then from here, active the postSessionDecisions
									setTimeout(() => { 
										handlePostSessionDecision(postSessionDecision, { controller, bot, SlackUserId });
									}, 500);
								});

								// set reminders (usually a break)
								reminders.forEach((reminder) => {
									const { remindTime, customNote, type } = reminder;
									models.Reminder.create({
										UserId,
										remindTime,
										customNote,
										type
									});
								});

							};
						});
					});
				});
			});
		})
	});

	/**
	 * 			~~ START OF END_SESSION FLOW FUNCTIONALITIES ~~
	 */

	// the actual end_session flow
	controller.on('end_session', (bot, config) => {

		/**
		 * 		User has agreed for session to end at this point
		 */

		const { SlackUserId, botCallback, defaultBreakTime } = config;
		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot          = bots[botToken];
		}

		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

			// object that contains values important to this conversation
			convo.sessionEnd = {
				SlackUserId,
				postSessionDecision: false, // what is the user's decision? (break, another session, etc.)
				reminders: [], // there will be lots of potential reminders
				tasksCompleted: [],
				defaultBreakTime
			};

			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {

				// need user's timezone for this flow!
				const { SlackUser: { tz } } = user;
				if (!tz) {
					bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
						convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
					});
					return;
				}

				convo.sessionEnd.UserId = user.id;
				convo.sessionEnd.tz     = tz;

				// this will close all sessions < now (as it should)!
				closeOldRemindersAndSessions(user);

				return user.getDailyTasks({
					where: [ `"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live" ],
					order: `"DailyTask"."priority" ASC`,
					include: [ models.Task ]
				});
			})
			.then((dailyTasks) => {

				var taskArray              = convertToSingleTaskObjectArray(dailyTasks, "daily");
				convo.sessionEnd.taskArray = taskArray;
				var taskListMessage        = convertArrayToTaskListMessage(taskArray);

				if (taskArray.length == 0) {
					convo.say("You don't have any tasks on today's list! Great work :punch:");
					convo.sessionEnd.hasNoTasksToWorkOn = true;
					askUserPostSessionOptions(err, convo);
					convo.next();
				} else {
					convo.say("Which task(s) did you get done? `i.e. tasks 1, 2`");
					convo.ask({
						text: `${taskListMessage}`,
						attachments:[
							{
								attachment_type: 'default',
								callback_id: "FINISH_TASKS_ON_END_SESSION",
								fallback: "I was unable to process your decision",
								color: colorsHash.grey.hex,
								actions: [
									{
										name: buttonValues.differentTask.name,
										text: "Something Else",
										value: buttonValues.differentTask.value,
										type: "button"
									},
									{
										name: buttonValues.noTasks.name,
										text: "None yet!",
										value: buttonValues.noTasks.value,
										type: "button"
									}
								]
							}
						]
					},[
						{
							pattern: buttonValues.noTasks.value,
							callback: (response, convo) => {
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{ // same as clicking buttonValues.noTasks.value
							pattern: utterances.containsNone,
							callback: (response, convo) => {

								// delete button when answered with NL
								deleteConvoAskMessage(response.channel, bot);

								convo.say("No worries! :smile_cat:");
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{
							pattern: buttonValues.differentTask.value,
							callback: (response, convo) => {
								askForDifferentCompletedTask(response, convo);
								convo.next();
							}
						},
						{ // same as clicking buttonValues.differentTask.value
							pattern: utterances.containsDifferent,
							callback: (response, convo) => {

								// delete button when answered with NL
								deleteConvoAskMessage(response.channel, bot);

								convo.say("What did you get done instead?")
								askForDifferentCompletedTask(response, convo);
								convo.next();
							}
						},
						{ // user has listed task numbers here
							default: true,
							callback: (response, convo) => {

								// user inputed task #'s (`2,4,1`), not new task button
								var { intentObject: { entities } } = response;
								var tasksCompletedString = response.text;

								var taskNumberCompletedArray = convertTaskNumberStringToArray(tasksCompletedString, taskArray);

  							// repeat convo if invalid w/ informative context
							  if (taskNumberCompletedArray) {
							    
							    // get the actual ids
									var tasksCompletedArray = [];
									taskNumberCompletedArray.forEach((taskNumber) => {
										var index = taskNumber - 1; // to make 0-index based
										if (taskArray[index])
											tasksCompletedArray.push(taskArray[index].dataValues.id);
									});

									convo.sessionEnd.tasksCompleted = tasksCompletedArray;
									convo.say("Great work :punch:");
									askUserPostSessionOptions(response, convo);

							  } else {

							  	convo.say("Oops, I don't totally understand :dog:. Let's try this again");
							    convo.say("You can pick a task from your list `i.e. tasks 1, 3` or say `none`");
							    convo.repeat();

							  }
							  convo.next();
							}
						}
					]);
				}
			});

			convo.on('end', (convo) => {
				console.log("SESSION END!!!");

				var responses = convo.extractResponses();
				var {sessionEnd } = convo;

				if (convo.status == 'completed') {

					console.log("CONVO SESSION END: ");
					console.log(convo.sessionEnd);

					// went according to plan
					const { SlackUserId, UserId, postSessionDecision, reminders, tasksCompleted, taskArray, differentCompletedTask, tz } = convo.sessionEnd;

					// end all live sessions and reminder checkins (type `work_session`) the user might have
					models.User.find({
						where: [`"User"."id" = ?`, UserId ],
						include: [ models.SlackUser ]
					})
					.then((user) => {

						/**
						 * 		~~ END OF WORK SESSION ~~
						 * 			1. cancel all `break` and `checkin` reminders
						 * 			2. mark said `tasks` as done
						 * 			3. handle postSession decision (set `break` reminder, start new session, etc.)
						 * 			4. close all live worksessions
						 * 			5. if completed diff task, store that for user
						 */

						// cancel all checkin reminders (type: `work_session` or `break`)

						// set reminders (usually a break)
						reminders.forEach((reminder) => {
							const { remindTime, customNote, type } = reminder;
							models.Reminder.create({
								UserId,
								remindTime,
								customNote,
								type
							});
						});

						// mark appropriate tasks as done
						let count = 0;
						tasksCompleted.forEach((TaskId) => {
							models.DailyTask.find({
								where: { id: TaskId },
								include: [ models.Task] 
							})
							.then((dailyTask) => {
								if (dailyTask) {
									dailyTask.Task.updateAttributes({
										done: true
									})
								}
							})
							count++;
							if (count == tasksCompleted.length) {
								setTimeout(() => {
									prioritizeDailyTasks(user);
								}, 500);
							}
						});

						
						// get the most recent work session
						// to handle if user got new task done
						user.getWorkSessions({
							limit: 1,
							order: `"createdAt" DESC`
						})
						.then((workSessions) => {

							var endTime = moment();

							// IF you chose a new task not on your list to have completed
							if (differentCompletedTask) {

								var minutes; // calculate time worked on that task
								if (workSessions.length > 0) {

									// use this to get how long the
									// custom added task took
									var startSession = workSessions[0];
									var startTime    = moment(startSession.startTime);
									minutes          = moment.duration(endTime.diff(startTime)).asMinutes();

								} else {
									// this should never happen.
									minutes = 30; // but if it does... default minutes duration
								}

								// create new task that the user just got done
								user.getDailyTasks({
									where: [ `"DailyTask"."type" = ?`, "live" ]
								})
								.then((dailyTasks) => {
									const priority = dailyTasks.length+1;
									const text     = differentCompletedTask;
									// record the different completed task
									models.Task.create({
										text,
										done: true
									})
									.then((task) => {
										const TaskId = task.id;
										models.DailyTask.create({
											TaskId,
											priority,
											minutes,
											UserId
										})
										.then(() => {
											prioritizeDailyTasks(user);
										})
									})
								});
							}

							setTimeout(() => {
								handlePostSessionDecision(postSessionDecision, { controller, bot, SlackUserId });
							}, 800);

						});

					});
				

				} else {
					// FIX POTENTIAL PITFALLS HERE
					if (!sessionEnd.postSessionDecision) {
						convo.say("I'm not sure went wrong here :dog: Please let my owners know");
					}
				}
			});

		});

	});

};

// ask user for options after finishing session
export function askUserPostSessionOptions(response, convo) {

	const { task }                = convo;
	var defaultBreakTime = false;
	if (convo.sessionEnd) {
		defaultBreakTime = convo.sessionEnd.defaultBreakTime;
	}

	var breakText = defaultBreakTime ? `Break for ${defaultBreakTime} min` : `Take a break`;
	const { bot, source_message } = task;
	
	// only if first time!
	// convo.say("I recommend taking a 15 minute break after about 90 minutes of focused work to keep your mind and attention fresh :tangerine:");
	// convo.say("Breaks are great times to read books and articles, or take a walk outside to get some fresh air :books: :walking:");
	convo.ask({
    text: `Would you like to take a break now, or start a new session?`,
    attachments:[
      {
        attachment_type: 'default',
        callback_id: "END_SESSION",
        color: colorsHash.turquoise.hex,
        fallback: "I was unable to process your decision",
        actions: [
          {
              name: buttonValues.takeBreak.name,
              text: breakText,
              value: buttonValues.takeBreak.value,
              type: "button"
          },
          {
              name: buttonValues.startSession.name,
              text: "Another session :muscle:",
              value: buttonValues.startSession.value,
              type: "button"
          },
          {
              name: buttonValues.backLater.name,
              text: "Be Back Later",
              value: buttonValues.backLater.value,
              type: "button"
          },
          {
              name: buttonValues.endDay.name,
              text: "End my day :sleeping:",
              value: buttonValues.endDay.value,
              type: "button",
              style: "danger"
          }
        ]
      }
    ]
  },
  [
    {
      pattern: buttonValues.takeBreak.value,
      callback: function(response, convo) {

      	getBreakTime(response, convo);
        convo.next();

      }
    },
    { // NL equivalent to buttonValues.takeBreak.value
      pattern: utterances.containsBreak,
      callback: function(response, convo) {
      	
      	// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say(`Let's take a break!`);
        getBreakTime(response, convo);
        convo.next();
      }
    },
    {
      pattern: buttonValues.startSession.value,
      callback: function(response, convo) {
        convo.sessionEnd.postSessionDecision = intentConfig.START_SESSION;
        convo.next();
      }
    },
    { // NL equivalent to buttonValues.startSession.value
      pattern: utterances.startSession,
      callback: function(response, convo) {

      	// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

      	convo.sessionEnd.postSessionDecision = intentConfig.START_SESSION;
        convo.next();
      }
    },
    {
      pattern: buttonValues.endDay.value,
      callback: function(response, convo) {
        convo.sessionEnd.postSessionDecision = intentConfig.END_DAY;
        convo.next();
      }
    },
    { // NL equivalent to buttonValues.endDay.value
      pattern: utterances.containsEnd,
      callback: function(response, convo) {

      	// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

        convo.sessionEnd.postSessionDecision = intentConfig.END_DAY;
        convo.next();
      }
    },
    {
      pattern: buttonValues.backLater.value,
      callback: function(response, convo) {
      	handleBeBackLater(response, convo)
        convo.next();
      }
    },
    { // NL equivalent to buttonValues.backLater.value
      pattern: utterances.containsBackLater,
      callback: function(response, convo) {

      	// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);
				
      	convo.say("Okay! I'll be here when you get back");
      	handleBeBackLater(response, convo)
        convo.next();
      }
    },
    { // this is failure point. restart with question
      default: true,
      callback: function(response, convo) {
        convo.say("I didn't quite get that :dog:. Let's choose an option from the buttons for now");
        convo.repeat();
        convo.next();
      }
    }
  ]);
	
}

// user has completed a different task and we'll take note
function askForDifferentCompletedTask(response, convo) {
	convo.ask("I'll add it as a completed task for you :memo:", (response, convo) => {
		convo.sessionEnd.differentCompletedTask = response.text;
		convo.say("Noted!");
		askUserPostSessionOptions(response, convo);
		convo.next();
	})
}

// simple way to handle be back later
function handleBeBackLater(response, convo) {
	convo.say("You can also ask for me to check in with you at a specific time later :grin:");
}

// handle break time
// if button click: default break time
// if NL, default if no duration or datetime suggested
function getBreakTime(response, convo) {

	var { text, intentObject: { entities: { duration, datetime } } } = response;
	const { sessionEnd: { tz, defaultBreakTime, UserId } }       = convo;
	var now = moment();

	convo.sessionEnd.postSessionDecision = intentConfig.WANT_BREAK; // user wants a break!

	var customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
	if (!customTimeObject) {

		// use default break time if it doesn't exist!
		if (!defaultBreakTime && UserId) {
			convo.say(`This is your first time hitting break! The default break time is *${TOKI_DEFAULT_BREAK_TIME} minutes*, but you can change it in your settings by telling me to \`show settings\``);
			convo.say("You can also specify a custom break time by saying `break for 20 minutes` or something like that :grinning:");
			// first time not updating at convo end...
			models.User.update({
				defaultBreakTime: 10
			}, {
				where: [`"Users"."id" = ?`, UserId]
			});
		}
		customTimeObject = moment().add(TOKI_DEFAULT_BREAK_TIME, 'minutes');

	}
	var customTimeString = customTimeObject.format("h:mm a");
	var durationMinutes   = parseInt(moment.duration(customTimeObject.diff(now)).asMinutes());

	if (!defaultBreakTime && UserId) {
		convo.say(`I set your default break time to ${TOKI_DEFAULT_BREAK_TIME} minutes and will check with you then. See you at *${customTimeString}*!`);
	} else {
		convo.say(`I'll check in with you in ${durationMinutes} minutes at *${customTimeString}* :smile:`);
	}
	
	convo.sessionEnd.reminders.push({
		customNote: `It's been ${durationMinutes} minutes. Let me know when you're ready to start a session`,
		remindTime: customTimeObject,
		type: "break"
	});

	convo.sessionEnd.breakDuration = durationMinutes;
	convo.next();

}

// NEED ALL 3 FOR CONFIG: SlackUserId, controller, bot
export function handlePostSessionDecision(postSessionDecision, config) {

	const { SlackUserId, controller, bot } = config;

	switch (postSessionDecision) {
		case intentConfig.WANT_BREAK:
			break;
		case intentConfig.END_DAY:
			controller.trigger('trigger_day_end', [bot, { SlackUserId }]);
			return;
		case intentConfig.START_SESSION:
			let config = { taskDecision: TASK_DECISION.work.word, SlackUserId };
			controller.trigger('edit_tasks_flow', [bot, config]);
			return;
		default: break;
	}

	// this is the end of the conversation, which is when we will
	// resume all previously canceled sessions
	resumeQueuedReachouts(bot, { SlackUserId });
}