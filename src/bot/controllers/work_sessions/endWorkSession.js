import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, convertMinutesToHoursString, deleteConvoAskMessage, deleteMostRecentDoneSessionMessage } from '../../lib/messageHelpers';
import { closeOldRemindersAndSessions, witTimeResponseToTimeZoneObject, prioritizeDailyTasks } from '../../lib/miscHelpers';

import { bots, resumeQueuedReachouts } from '../index';

import { colorsArray, buttonValues, colorsHash, TOKI_DEFAULT_SNOOZE_TIME, TOKI_DEFAULT_BREAK_TIME, sessionTimerDecisions, MINUTES_FOR_DONE_SESSION_TIMEOUT, pausedSessionOptionsAttachments, startSessionOptionsAttachments, TASK_DECISION, endBreakEarlyAttachments,  intentConfig } from '../../lib/constants';
import { doneSessionAskOptions } from '../modules/endWorkSessionFunctions';

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
										where: [`"DailyTask"."type" = ?`, "live"],
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
													replacePriority: {},
													extendSession: false,
													postSessionDecision: false
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
													console.log(convo.sessionDone);
													console.log("\n\n\n");

													const { SlackUserId, dailyTask, reminders, extendSession, postSessionDecision, currentSession: { WorkSessionId } } = convo.sessionDone;

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

													if (postSessionDecision) {
														const config = { SlackUserId };
														switch (postSessionDecision) {
															case (intentConfig.VIEW_PLAN):
																controller.trigger(`plan_command_center`, [ bot, config ]);
																break;
															default: break;
														}
													}

												})

											});

										});
									})

								}

							});

						});
					})

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
								controller.trigger('begin_session', [bot, { SlackUserId }]);
							} else {
								resumeQueuedReachouts(bot, { SlackUserId });
							}
						});
					});

				}

			});

		});

	});

}



