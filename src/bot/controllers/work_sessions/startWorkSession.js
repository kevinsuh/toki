import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone, closeOldRemindersAndSessions } from '../../lib/miscHelpers';

import intentConfig from '../../lib/intents';
import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash } from '../../lib/constants';

import { startSessionStartConversation, confirmTimeForTasks } from './startWorkSessionFunctions';

import { resumeQueuedReachouts } from '../index';

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
	controller.hears(['start_session'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;
		var intent = intentConfig.START_SESSION;

		var config = {
			intent,
			SlackUserId
		}

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			controller.trigger(`new_session_group_decision`, [ bot, config ]);
		}, 1000);

	});

	/**
	 * 				EVERY CREATED SESSION GOES THROUGH THIS FIRST
	 *   		*** this checks if there is an existing open session ***
	 *   			if no open sessions => `begin_session`
	 *   			else => go through this flow
	 */
	controller.on(`confirm_new_session`, (bot, config) => {

		/**
		 * 		User can either:
		 * 			1. Keep going
		 * 			2. Start new session by ending this one early
		 * 					- update endTime in session to now
		 * 					- mark it as done and re-enter `begin_session`
		 */

		const { SlackUserId, dailyTasksToWorkOn } = config;
		console.log("\n\n\n\n\nin `confirm_new_session` before entering begin_session flow!\n\n\n\n\n");

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			var now = moment().format("YYYY-MM-DD HH:mm:ss Z");
			user.getWorkSessions({
				where: [`"open" = ? AND "endTime" > ?`, true, now ]
			})
			.then((workSessions) => {

				const { SlackUser: { tz } } = user;

				// no live work sessions => you're good to go!
				if (workSessions.length == 0) {
					controller.trigger(`begin_session`, [ bot, config]);
					return;
				}

				// otherwise, we gotta confirm user wants to cancel current work session

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					// by default, user wants to start a new session
					// that's why she is in this flow...
					// no liveWorkSession unless we found one
					convo.startNewSession = true;
					convo.liveWorkSession = false;

					var liveWorkSession = workSessions[0]; // deal with first one as reference point
					convo.liveWorkSession = liveWorkSession;

					var endTime       = moment(liveWorkSession.endTime).tz(tz);
					var endTimeString = endTime.format("h:mm a");
					var now           = moment();
					var minutesLeft   = Math.round(moment.duration(endTime.diff(now)).asMinutes());

					convo.say(`You are already in a session until *${endTimeString}*! You have ${minutesLeft} minutes left :timer_clock:`);
					convo.ask(`Do you want to \`keep going\`, or cancel it and start a \`new session\`?`, (response, convo) => {

						var responseMessage = response.text;
						var { intentObject: { entities } } = response;

						var newSession = new RegExp(/(((^st[tart]*))|(^ne[ew]*)|(^se[ession]*))/); // `start` or `new`
						var keepGoing = new RegExp(/(((^k[ep]*))|(^go[oing]*))/); // `keep` or `going`

						if (newSession.test(responseMessage)) {

							// start new session
							convo.say("Sounds good :facepunch:");

						} else if (keepGoing.test(responseMessage)) {

							// continue current session
							convo.say("Got it. Let's do it! :weight_lifter:");
							convo.say(`I'll ping you at ${endTimeString} :alarm_clock:`);
							convo.startNewSession = false;

						} else {

							// invalid
							convo.say("I'm sorry, I didn't catch that :dog:");
							convo.repeat();

						}
						convo.next();

					});

					convo.on('end', (convo) => {

						console.log("\n\n\n ~~ here in end of confirm_new_session ~~ \n\n\n");

						const { startNewSession, liveWorkSession } = convo;

						// if user wants to start new session, then do this flow and enter `begin_session` flow
						if (startNewSession) {

							/**
							 * 		~ User has confirmed starting a new session ~
							 * 			* end current work session early
							 * 			* cancel all existing open work sessions
							 * 			* cancel `break` reminders
							 */

							var now = moment();

							// if user had any live work session(s), cancel them!
							if (liveWorkSession) {
								liveWorkSession.update({
									endTime: now,
									open: false,
									live: false
								});
								workSessions.forEach((workSession) => {
									workSession.update({
										open: false,
										live: false
									})
								});
							};

							// cancel all user breaks cause user is RDY TO WORK
							models.User.find({
								where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
								include: [
									models.SlackUser
								]
							})
							.then((user) => {
								user.getReminders({
									where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break"] ]
								}).
								then((reminders) => {
									reminders.forEach((reminder) => {
										reminder.update({
											"open": false
										})
									});
								})
							});
							controller.trigger(`begin_session`, [ bot, config ]);
						} else {
							resumeQueuedReachouts(bot, { SlackUserId });
						}

					});
				});
			});
		})
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

		const { SlackUserId  }     = config;
		var { dailyTasksToWorkOn } = config;

		console.log("in begin session:");
		console.log(config);
		console.log("\n\n")

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [ models.SlackUser ]
		}).then((user) => {

			// need user's timezone for this flow!
			const { SlackUser: { tz } } = user;

			if (!tz) {
				bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
					convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
				});
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name = user.nickName || user.email;

				// configure necessary properties on convo object
				convo.name = name;

				// object that contains values important to this conversation
				// tz will be important as time goes on
				convo.sessionStart = {
					UserId: user.id,
					SlackUserId,
					tasksToWorkOnHash: {},
					tz,
					newTask: {}
				};

				// FIND DAILY TASKS, THEN START THE CONVERSATION
				user.getDailyTasks({
					where: [`"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live"],
					order: `"priority" ASC`,
					include: [ models.Task ]
				}).then((dailyTasks) => {

					// save the daily tasks for reference
					dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
					convo.sessionStart.dailyTasks = dailyTasks;

					// user needs to enter daily tasks
					if (dailyTasks.length == 0) {
						convo.sessionStart.noDailyTasks = true;
						convo.stop();
					} else if (dailyTasksToWorkOn && dailyTasksToWorkOn.length > 0) {

						/**
						 * ~~ USER HAS PASSED IN DAILY TASKS TO WORK ON FOR THIS SESSION ~~
						 */
						dailyTasksToWorkOn = convertToSingleTaskObjectArray(dailyTasksToWorkOn, "daily");

						var tasksToWorkOnHash = {};
						dailyTasksToWorkOn.forEach((dailyTask, index) => {
							tasksToWorkOnHash[index] = dailyTask;
						});

						convo.sessionStart.tasksToWorkOnHash  = tasksToWorkOnHash;

						confirmTimeForTasks(err, convo);
						convo.next();

					} else {
						
						// let's turn off sessions and reminders here
						closeOldRemindersAndSessions(user);
						
						// entry point of thy conversation
						startSessionStartConversation(err, convo);
					}

				});

				// on finish convo
				convo.on('end', (convo) => {

					var responses        = convo.extractResponses();
					var { sessionStart } = convo;
					var { SlackUserId, confirmStart } = sessionStart;
					var now = moment();

					if (confirmStart) {

						/**
						*    1. tell user time and tasks to work on
						*    
						*    2. save responses to DB:
						*      session:
						*        - tasks to work on (tasksToWorkOnHash)
						*        - sessionEndTime (calculated)
						*        - reminder (time + possible customNote)
						*
						*    3. start session
						*/

						var { UserId, SlackUserId, dailyTasks, calculatedTime, calculatedTimeObject, tasksToWorkOnHash, checkinTimeObject, reminderNote, newTask, tz } = sessionStart;

						// cancel all user breaks cause user is RDY TO WORK
						models.User.find({
							where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
							include: [
								models.SlackUser
							]
						})
						.then((user) => {

							// END ALL REMINDERS BEFORE CREATING NEW ONE
							user.getReminders({
								where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break", "done_session_snooze"] ]
							}).
							then((reminders) => {
								reminders.forEach((reminder) => {
									reminder.update({
										"open": false
									})
								});
								// if user wanted a checkin reminder
								if (checkinTimeObject) {
									models.Reminder.create({
										remindTime: checkinTimeObject,
										UserId,
										customNote: reminderNote,
										type: "work_session"
									});
								}
							});

							// 1. create work session 
							// 2. attach the daily tasks to work on during that work session
							var startTime = moment();
							var endTime   = calculatedTimeObject;

							// create necessary data models:
							//  array of Ids for insert, taskObjects to create taskListMessage
							var dailyTaskIds       = [];
							var tasksToWorkOnArray = [];
							for (var key in tasksToWorkOnHash) {
								var task = tasksToWorkOnHash[key];
								if (task.dataValues) { // existing tasks
									dailyTaskIds.push(task.dataValues.id);
								}
								tasksToWorkOnArray.push(task);
							}

							// END ALL WORK SESSIONS BEFORE CREATING NEW ONE
							user.getWorkSessions({
								where: [`"live" = ?`, true ]
							})
							.then((workSessions) => {
								workSessions.forEach((workSession) => {
									workSession.update({
										open: false,
										live: false
									})
								});

								models.WorkSession.create({
									startTime,
									endTime,
									UserId
								}).then((workSession) => {
									workSession.setDailyTasks(dailyTaskIds);

									// if new task, insert that into DB and attach to work session
									if (newTask.text && newTask.minutes) {

										const priority          = (dailyTasks.length+1);
										const { text, minutes } = newTask;
										models.Task.create({
											text
										})
										.then((task) => {
											models.DailyTask.create({
												TaskId: task.id,
												priority,
												minutes,
												UserId
											})
											.then((dailyTask) => {
												workSession.setDailyTasks([dailyTask.id]);
											})
										});
									}
								});

							})

							/**
							 * 		~~ START WORK SESSION MESSAGE ~~
							 */

							let tasksToWorkOnTexts = tasksToWorkOnArray.map((dailyTask) => {
								if (dailyTask.dataValues) {
									return dailyTask.dataValues.Task.text;
								} else {
									return dailyTask.text;
								}
							});

							let tasksString = commaSeparateOutTaskArray(tasksToWorkOnTexts);
							let minutesDuration = Math.round(moment.duration(calculatedTimeObject.diff(now)).asMinutes());
							let timeString = convertMinutesToHoursString(minutesDuration);

							bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
							
								convo.say(`Good luck with ${tasksString}!`);
								convo.say({
									text: `See you in ${timeString} at *${calculatedTime}* :timer_clock:`,
									attachments:[
										{
											attachment_type: 'default',
											callback_id: "START_SESSION_OPTIONS",
											fallback: "Good luck with your session!",
											actions: [
												{
														name: buttonValues.startSession.pause.name,
														text: "Pause",
														value: buttonValues.startSession.pause.value,
														type: "button"
												},
												{
														name: buttonValues.startSession.addCheckIn.name,
														text: "Add check-in",
														value: buttonValues.startSession.addCheckIn.value,
														type: "button"
												},
												{
														name: buttonValues.startSession.endEarly.name,
														text: "End Early",
														value: buttonValues.startSession.endEarly.value,
														type: "button",
														style: "danger"
												}
											]
										}
									]
								});
								convo.next();

							});

						});

					} else {

						// ending convo prematurely 
						if (sessionStart.noDailyTasks) {

							console.log("\n\n ~~ NO DAILY TASKS ~~ \n\n");

							const { task }                = convo;
							const { bot, source_message } = task;

							var fiveHoursAgo = moment().subtract(5, 'hours').format("YYYY-MM-DD HH:mm:ss Z");

							user.getWorkSessions({
								where: [`"WorkSession"."endTime" > ?`, fiveHoursAgo]
							})
							.then((workSessions) => {

								// start a new day if you have not had a work session in 5 hours
								const startNewDay = (workSessions.length == 0 ? true : false);
								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

									convo.startNewDay = startNewDay;

									if (startNewDay) {
										convo.say("Hey! You haven't entered any tasks yet today. Let's start the day before doing a session :muscle:");
									} else {
										convo.say("Hey! Let's get things to work on first");
									}

									convo.next();

									convo.on('end', (convo) => {
										// go to start your day from here
										var config          = { SlackUserId };
										var { startNewDay } = convo;

										if (startNewDay) {
											controller.trigger('begin_day_flow', [bot, config]);
										} else {
											controller.trigger('edit_tasks_flow', [ bot, config ]);
										}

									})
								});
							});
						}
					}
				});
			});
		});
	});
}

