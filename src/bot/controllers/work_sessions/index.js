import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';
import moment from 'moment-timezone';

import endWorkSessionController from './endWorkSession';
import endWorkSessionTimeoutsController from './endWorkSessionTimeouts';
import startWorKSessionController from './startWorkSession';

import intentConfig from '../../lib/intents';
import { hoursForExpirationTime, startDayExpirationTime, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { utterances } from '../../lib/botResponses';

import { askUserPostSessionOptions, handlePostSessionDecision } from './endWorkSession';

import { resumeQueuedReachouts } from '../index';

// base controller for work sessions!
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startWorKSessionController(controller);
	endWorkSessionController(controller);
	endWorkSessionTimeoutsController(controller);

	/**
	 * 		IS_BACK ("READY TO WORK" - Peon WC3)
	 */
	
	controller.hears(['is_back'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			// find user then reply
			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId],
				include: [ models.SlackUser ]
			})
			.then((user) => {

				var shouldStartNewDay = false;

				// is user already in a work session?
				user.getWorkSessions({
					where: [`"live" = ?`, true ]
				})
				.then((workSessions) => {

					if (workSessions.length > 0) {
						// user is in a work session
						var config = { SlackUserId };
						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

							var name = user.nickName || user.email;
							var message = `Welcome back, ${name}!`;
							convo.say(message);

							convo.on(`end`, (convo) => {
								controller.trigger(`confirm_new_session`, [ bot, config ]);
							});
						});
						return;
					}

					// otherwise, do normal flow
						// 1. has user started day yet?
					user.getSessionGroups({
						order: `"SessionGroup"."createdAt" DESC`,
						limit: 1
					})
					.then((sessionGroups) => {

						if (sessionGroups.length == 0) {
							shouldStartNewDay = true;
						} else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
							shouldStartNewDay = true;
						}

						user.getWorkSessions({
							where: [`"WorkSession"."endTime" > ? `, startDayExpirationTime]
						})
						.then((workSessions) => {

							if (workSessions.length == 0) {

								if (sessionGroups[0] && sessionGroups[0].type == "start_work") {
									// if you started a day recently, this can be used as proxy instead of a session
									var startDaySessionTime = moment(sessionGroups[0].createdAt);
									var now                 = moment();
									var hoursSinceStartDay  = moment.duration(now.diff(startDaySessionTime)).asHours();
									if (hoursSinceStartDay > hoursForExpirationTime) {
										shouldStartNewDay = true;
									}
								} else {
									shouldStartNewDay = true;
								}
							}



							var config = { SlackUserId, shouldStartNewDay };
							console.log(`Config: \n`);
							console.log(config);
							controller.trigger(`is_back_flow`, [ bot, config ]);

						});

					});

				})
			});
		}, 1000);
		
	});

	controller.on(`is_back_flow`, (bot, config) => {

		const { SlackUserId, shouldStartNewDay } = config;
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId],
			include: [ models.SlackUser ]
		})
		.then((user) => {
			user.getDailyTasks({
				where: [`"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live"],
				include: [ models.Task ],
				order: `"DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {

				dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
				var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					convo.isBack = {
						SlackUserId,
						shouldStartNewDay,
						dailyTasks,
						isBackDecision: false // what user wants to do
					}

					var name = user.nickName || user.email;

					// give response based on state user is in
					var message = `Welcome back, ${name}!`;
					if (shouldStartNewDay) {
						if (dailyTasks.length > 0) {
							message = `${message} Here are your priorities from our last time together:\n${taskListMessage}`;
						}
						convo.say(message);
						shouldStartNewDayFlow(err, convo);
					} else {
						if (dailyTasks.length > 0) {
							message = `${message} Here are your current priorities:\n${taskListMessage}`;
						}
						convo.say(message);
						shouldStartSessionFlow(err, convo);
					}

					convo.on(`end`, (convo) => {

						// cancel all `break` and `work_session` type reminders
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

						const { isBackDecision } = convo;
						var config = { SlackUserId };
						if (convo.status == 'completed') {
							switch (isBackDecision) {
								case intentConfig.START_DAY:
									controller.trigger(`begin_day_flow`, [ bot, config ]);
									break;
								case intentConfig.START_SESSION:
									config.intent = intentConfig.START_SESSION;
									controller.trigger(`new_session_group_decision`, [ bot, config ]);
									break;
								case intentConfig.REMINDER:
									controller.trigger(`ask_for_reminder`, [ bot, config ]);
									break;
								case intentConfig.END_DAY:
									config.intent = intentConfig.END_DAY;
									controller.trigger(`new_session_group_decision`, [ bot, config ]);
									break;
								case intentConfig.VIEW_TASKS:
									config.intent = intentConfig.VIEW_TASKS;
									controller.trigger(`new_session_group_decision`, [ bot, config ]);
									break;
								case intentConfig.ADD_TASK:
									config.intent = intentConfig.ADD_TASK;
									controller.trigger(`new_session_group_decision`, [ bot, config ]);
								default:
									resumeQueuedReachouts(bot, { SlackUserId });
									break;
							}
						} else {
							bot.reply(message, "Okay! Let me know when you want to start a session or day");
							resumeQueuedReachouts(bot, { SlackUserId });
						}
					});
				});

			})
		});

	});

};

// user should start a new day
function shouldStartNewDayFlow(err, convo) {

	const { dailyTasks } = convo.isBack;

	var message = `*Ready to make a plan for today?*`;
	if (dailyTasks.length > 0) {
		message = `${message} If the above tasks are what you want to work on, we can start a session with those instead :pick:`;
	}
	convo.ask({
		text: message,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "IS_BACK_START_DAY",
				fallback: "You should start a new day",
				actions: [
					{
							name: buttonValues.startDay.name,
							text: "Plan :memo:",
							value: buttonValues.startDay.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.startSession.name,
							text: "Start session",
							value: buttonValues.startSession.value,
							type: "button"
					},
					{
							name: buttonValues.createReminder.name,
							text: "Set reminder",
							value: buttonValues.createReminder.value,
							type: "button"
					},
					{
							name: buttonValues.endDay.name,
							text: "End day",
							value: buttonValues.endDay.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{ // user does not want any of the options
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say(`Okay! I'll be here whenever you're ready :hand:`);
				convo.next();
			}
		},
		{
			pattern: buttonValues.startDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startDay.value
			pattern: utterances.containsPlan,
			callback: function(response, convo) {
				convo.say(`Let's do it!`);
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startDay.value
			pattern: utterances.specificYes,
			callback: function(response, convo) {
				convo.say(`Let's do it!`);
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{
			pattern: buttonValues.startSession.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startSession.value
			pattern: utterances.startSession,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{
			pattern: buttonValues.createReminder.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.createReminder.value
			pattern: utterances.containsCheckin,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{
			pattern: buttonValues.endDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.END_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.endDay.value
			pattern: utterances.containsEnd,
			callback: function(response, convo) {
				convo.say(`It's about that time, isn't it?`);
				convo.isBackDecision = intentConfig.END_DAY;
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

}

// user should start a session
function shouldStartSessionFlow(err, convo) {

	convo.ask({
		text: `*Ready to start another session?*`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "IS_BACK_START_SESSION",
				fallback: "You should start a new session",
				actions: [
					{
							name: buttonValues.startSession.name,
							text: "Start session :muscle:",
							value: buttonValues.startSession.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.createReminder.name,
							text: "Set reminder",
							value: buttonValues.createReminder.value,
							type: "button"
					},
					{
							name: buttonValues.endDay.name,
							text: "End day",
							value: buttonValues.endDay.value,
							type: "button"
					},
					{
							name: buttonValues.startDay.name,
							text: "New Plan",
							value: buttonValues.startDay.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{ // user does not want any of the options
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say(`Okay! I'll be here whenever you're ready :hand:`);
				convo.next();
			}
		},
		{
			pattern: buttonValues.startDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startDay.value
			pattern: utterances.containsPlan,
			callback: function(response, convo) {
				convo.say(`Let's do it!`);
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{
			pattern: buttonValues.startSession.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startSession.value
			pattern: utterances.yes,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{
			pattern: buttonValues.createReminder.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.createReminder.value
			pattern: utterances.containsCheckin,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{
			pattern: buttonValues.endDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.END_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.endDay.value
			pattern: utterances.containsEnd,
			callback: function(response, convo) {
				convo.say(`It's about that time, isn't it?`);
				convo.isBackDecision = intentConfig.END_DAY;
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

}

// check if work session has any live tasks
// if not, ask for a new session
export function checkWorkSessionForLiveTasks(config) {

	const { controller, bot, SlackUserId } = config;
	var now               = moment();

	/**
	 * 		This will check for open work sessions
	 * 		if NO tasks are live for open work sessions,
	 * 		trigger end and ask for new work session
	 */
	models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;
			const { SlackUser: { tz } } = user;

			user.getWorkSessions({
				where: [`"open" = ?`, true ]
			})
			.then((workSessions) => {

				if (workSessions.length > 0) {

					var openWorkSession = workSessions[0];
					openWorkSession.getDailyTasks({
						include: [ models.Task ]
					})
					.then((dailyTasks) => {

						var liveTasks       = [];

						dailyTasks.forEach((dailyTask) => {
							const { type, Task: { done } } = dailyTask;
							if (!done && type == "live") {
								liveTasks.push(dailyTask);
							}
						});

						// if no live tasks, end work session and ask for new one
						if (liveTasks.length == 0) {

							var finishedTaskTextsArray = [];
							dailyTasks.forEach((dailyTask) => {
								finishedTaskTextsArray.push(dailyTask.dataValues.Task.text);
							});
							var finishedTasksString = commaSeparateOutTaskArray(finishedTaskTextsArray);

							openWorkSession.update({
								open: false,
								live: false,
								endTime: now
							})
							.then((workSession) => {
								bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

									convo.sessionEnd = {
										UserId,
										tz,
										postSessionDecision: false,
										reminders: [],
										SlackUserId
									}

									var message = `Great job finishing ${finishedTasksString} :raised_hands:!`;
									convo.say(message);

									askUserPostSessionOptions(err, convo);

									convo.on('end', (convo) => {
										
										const { UserId, postSessionDecision, reminders, tz } = convo.sessionEnd;

										// create reminders if requested
										reminders.forEach((reminder) => {
											const { remindTime, customNote, type } = reminder;
											models.Reminder.create({
												UserId,
												remindTime,
												customNote,
												type
											});
										});

										// work session if requested
										handlePostSessionDecision(postSessionDecision, { controller, bot, SlackUserId });

									});
									
								});
							})

						} else {
							// inform user how much time is remaining
							// and what tasks are attached to the work session
							var liveTaskTextsArray = [];
							liveTasks.forEach((dailyTask) => {
								liveTaskTextsArray.push(dailyTask.dataValues.Task.text);
							});
							var liveTasksString = commaSeparateOutTaskArray(liveTaskTextsArray);

							var now           = moment();
							var endTime       = moment(openWorkSession.dataValues.endTime).tz(tz);
							var endTimeString = endTime.format("h:mm a");
							var minutes       = moment.duration(endTime.diff(now)).asMinutes();
							var minutesString = convertMinutesToHoursString(minutes);

							bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

								convo.say(`Good luck finishing ${liveTasksString}!`);

							});

						}

					});

				} else {
					bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
						convo.startSession = false;
						convo.ask("Shall we crank out one of your tasks? :wrench:", [
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
										convo.say("Okay! I'll be here when you're ready :fist:");
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
						convo.on('end', (convo) => {
							const { startSession } = convo;
							if (startSession) {
								var intent = intentConfig.START_SESSION;

								var config = {
									intent,
									SlackUserId
								}

								controller.trigger(`new_session_group_decision`, [ bot, config ]);
							}
						})
					});
				}

			});

		});

}