import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, convertMinutesToHoursString, deleteConvoAskMessage, deleteMostRecentDoneSessionMessage, getDoneSessionMessageAttachments } from '../../lib/messageHelpers';
import { closeOldRemindersAndSessions, witTimeResponseToTimeZoneObject, prioritizeDailyTasks } from '../../lib/miscHelpers';

import { bots, resumeQueuedReachouts } from '../index';

import { colorsArray, buttonValues, colorsHash, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME, sessionTimerDecisions, MINUTES_FOR_DONE_SESSION_TIMEOUT, pausedSessionOptionsAttachments, startSessionOptionsAttachments, TASK_DECISION, endBreakEarlyAttachments,  intentConfig } from '../../lib/constants';
import { doneSessionAskOptions } from '../modules/endWorkSessionFunctions';

import { notInSessionWouldYouLikeToStartOne } from './sessionOptions';

// END OF A WORK SESSION
export default function(controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', wit.hears, (bot, message) => {

		/**
		 * 			check if user has open session (should only be one)
		 * 					if yes, trigger finish and end_session flow
		 * 			  	if no, reply with confusion & other options
		 */
		
		const SlackUserId      = message.user;
		const doneSessionEarly = true;

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
			if (utterances.containsTaskOrPriority.test(message.text)) {
				// want to finish off some tasks
				controller.trigger(`edit_plan_flow`, [bot, { SlackUserId }]);
			} else {
				controller.trigger(`done_session_flow`, [bot, { SlackUserId, doneSessionEarly }]);
			}
		}, 800);
	});

	/**
	 * 		User has confirmed to ending session
	 * 		This will immediately close the session, then move to
	 * 		specified "post session" options
	 */
	controller.on(`done_session_flow`, (bot, config) => {

		// you can pass in a storedWorkSession
		const { SlackUserId, storedWorkSession, sessionTimerUp, doneSessionEarly } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const { SlackUser: { tz }, defaultBreakTime, defaultSnoozeTime } = user;
			const UserId = user.id;

			user.getWorkSessions({
				where: [ `"open" = ?`, true ],
				order: `"WorkSession"."createdAt" DESC`,
				include: [ models.DailyTask ]
			})
			.then((workSessions) => {

				let workSession = storedWorkSession || workSessions[0];

				if (workSession) {

					// only update endTime if it is less than current endTime
					let now     = moment();
					let endTime = moment(workSession.dataValues.endTime);
					if ( now < endTime )
						endTime = now;

					workSession.update({
						open: false,
						endTime
					})
					.then((workSession) => {

						const WorkSessionId       = workSession.id;
						let startTime             = moment(workSession.startTime).tz(tz);
						let endTime               = moment(workSession.dataValues.endTime).tz(tz);
						let endTimeString         = endTime.format("h:mm a");
						let workSessionMinutes    = Math.round(moment.duration(endTime.diff(startTime)).asMinutes());
						let workSessionTimeString = convertMinutesToHoursString(workSessionMinutes);

						workSession.getStoredWorkSession({
							where: [ `"StoredWorkSession"."live" = ?`, true ]
						})
						.then((storedWorkSession) => {

							let dailyTaskIds = workSession.DailyTasks.map((dailyTask) => {
								return dailyTask.id;
							});
							
							// this is the only dailyTask associated with workSession
							user.getDailyTasks({
								where: [ `"DailyTask"."id" IN (?)`, dailyTaskIds ],
								include: [ models.Task ]
							})
							.then((dailyTasks) => {

								if (dailyTasks.length > 0) {

									let dailyTask = dailyTasks[0]; // one task per session

									// get all live daily tasks for use
									user.getDailyTasks({
										where: [`"DailyTask"."type" = ? AND "Task"."done" = ?`, "live", false],
										order: `"DailyTask"."priority" ASC`,
										include: [ models.Task ]
									})
									.then((dailyTasks) => {

										dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

										// do our math update to daily task here
										let minutesSpent = dailyTask.minutesSpent;
										minutesSpent += workSessionMinutes;
										dailyTask.update({
											minutesSpent
										})
										.then((dailyTask) => {

											bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

												convo.sessionDone = {
													UserId,
													SlackUserId,
													defaultBreakTime,
													defaultSnoozeTime,
													tz,
													dailyTasks,
													doneSessionEarly,
													sessionTimerUp,
													reminders: [],
													currentSession: {
														WorkSessionId,
														startTime,
														endTime,
														workSessionMinutes,
														workSessionTimeString,
														dailyTask,
														additionalMinutes: false
													},
													extendSession: false,
													postSessionDecision: false,
													priorityDecision: { // what we want to do with our priorities as a result of session
														replacePriority: {}, // config for totally new priority
														switchPriority: {} // config to switch priority worked on this session
													}
												}

												if (storedWorkSession) {
													workSessionMinutes    = storedWorkSession.dataValues.minutes;
													workSessionTimeString = convertMinutesToHoursString(workSessionMinutes);
													// currently paused
													convo.doneSessionEarly.currentSession.isPaused = true;
													convo.doneSessionEarly.currentSession.workSessionTimeString = workSessionTimeString;
												}

												doneSessionAskOptions(convo);


												convo.on('end', (convo) => {

													console.log("\n\n\n session is done!");
													console.log(convo.sessionDone.priorityDecision);
													console.log("\n\n\n");

													const { UserId, SlackUserId, reminders, extendSession, postSessionDecision, currentSession: { WorkSessionId, workSessionMinutes, dailyTask, additionalMinutes }, priorityDecision } = convo.sessionDone;

													// if extend session, rest doesn't matter!
													if (extendSession) {
														workSession.update({
															open: true,
															live: true,
															endTime: extendSession
														});
														return;
													}

													reminders.forEach((reminder) => {
														const { remindTime, customNote, type } = reminder;
														models.Reminder.create({
															UserId,
															remindTime,
															customNote,
															type
														});
													});

													resumeQueuedReachouts(bot, { SlackUserId });



													// this is where you do the math with passed in info
													const { completeDailyTask, replacePriority, switchPriority } = priorityDecision;


													// COMPLETED!!!!
													if (completeDailyTask) {
														// mark the task as complete, then show updated plan list
														models.Task.update({
															done: true
														}, {
															where: [`"Tasks"."id" = ?`, dailyTask.dataValues.Task.id]
														})
														.then(() => {
															prioritizeDailyTasks(user);
														});
													} else {

														if (additionalMinutes > 0) {
															// if additional minutes requested,
															// set minutesAllotted equal to minutesSpent + additional minutes
															let { minutesSpent } = dailyTask.dataValues;
															let minutes = minutesSpent + additionalMinutes;
															dailyTask.update({
																minutes
															});
														}

														if (Object.keys(switchPriority).length > 0) {
															const { newPriorityIndex } = switchPriority;
															console.log("\n\n\nokay dealing with switch priority!");
															console.log(dailyTasks[newPriorityIndex]);
															let newDailyTask = dailyTasks[newPriorityIndex];

															// 1. undo minutesSpent to dailyTask
															let { minutesSpent } = dailyTask.dataValues;
															minutesSpent -= workSessionMinutes;
															dailyTask.update({
																minutesSpent
															});

															// 2. replace the dailyTask associated with current workSession
															models.WorkSessionTask.destroy({
																where: [`"WorkSessionTasks"."WorkSessionId" = ?`, WorkSessionId]
															})
															models.WorkSessionTask.create({
																WorkSessionId,
																DailyTaskId: newDailyTask.dataValues.id
															})
															.then(() => {
																// 3. re-open workSession and re-trigger `done_session` flow
																models.WorkSession.update({
																	open: true
																}, {
																	where: [`"WorkSessions"."id" = ?`, WorkSessionId]
																})
																.then(() => {

																	bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
																		convo.say(`Okay! I put time towards that priority instead`);
																		convo.next();
																		convo.on('end', (convo) => {
																			controller.trigger(`done_session_flow`, [bot, { SlackUserId }]);
																		})
																	});
																	return;
																})
															})

														} else if (Object.keys(replacePriority).length > 0) {
															const { dailyTaskIndexToReplace, newTaskText } = replacePriority;
															console.log("\n\n\n replacing this task:");
															console.log(dailyTasks[dailyTaskIndexToReplace]);
															console.log(replacePriority);

															// 1. undo minutes to task
															let { minutesSpent } = dailyTask.dataValues;
															minutesSpent -= workSessionMinutes;
															dailyTask.update({
																minutesSpent
															});

															// 2. change dailyTasks ("delete" the original one, then create this new one w/ NULL minutesAllocated)
															let dailyTaskToReplace = dailyTasks[dailyTaskIndexToReplace];
															const { id, priority } = dailyTaskToReplace.dataValues;
															models.DailyTask.update({
																type: "deleted"
															},{
																where: [`"DailyTasks"."id" = ?`, id]
															})
															models.Task.create({
																text: newTaskText
															})
															.then((task) => {
																task.createDailyTask({
																	priority,
																	UserId
																})
																.then((dailyTask) => {

																	// 3. replace newly created dailyTask as the dailyTask to the workSession
																	const DailyTaskId = dailyTask.id;
																	models.WorkSessionTask.destroy({
																		where: [`"WorkSessionTasks"."WorkSessionId" = ?`, WorkSessionId]
																	})
																	models.WorkSessionTask.create({
																		WorkSessionId,
																		DailyTaskId
																	})
																	.then(() => {
																		// 4. re-open work session and go through `done_session` flow
																		models.WorkSession.update({
																			open: true
																		}, {
																			where: [`"WorkSessions"."id" = ?`, WorkSessionId]
																		})
																		.then(() => {

																			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
																				convo.say(`Nice, that new priority looks great!`);
																				convo.next();
																				convo.on('end', (convo) => {
																					controller.trigger(`done_session_flow`, [bot, { SlackUserId }]);
																				})
																			});
																			return;

																		})
																	})
																})
															})
														}
													}

													if (postSessionDecision) {
														setTimeout(() => {
															const config = { SlackUserId };
															switch (postSessionDecision) {
																case (intentConfig.VIEW_PLAN):
																	controller.trigger(`plan_command_center`, [ bot, config ]);
																	break;
																default: break;
															}
														}, 750);
														
													}

												})
											});
										});
									});
								}
							});
						});
					})

				} else {

					let config = { bot, controller, SlackUserId };
					notInSessionWouldYouLikeToStartOne(config);

				}

			});

		});

	});

}



