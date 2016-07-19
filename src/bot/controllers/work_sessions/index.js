import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';
import moment from 'moment-timezone';

import endWorkSessionController from './endWorkSession';
import endWorkSessionTimeoutsController from './endWorkSessionTimeouts';
import startWorKSessionController from './startWorkSession';

import intentConfig from '../../lib/intents';
import { hoursForExpirationTime, startDayExpirationTime, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertMinutesToHoursString, deleteConvoAskMessage, convertTaskNumberStringToArray } from '../../lib/messageHelpers';
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
									console.log(`hours since start day: ${hoursSinceStartDay}`);
									console.log(`hours for expiration time: ${hoursForExpirationTime}`);
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

			user.getWorkSessions({
				where: [`"open" = ?`, true]
			})
			.then((workSessions) => {

				var openWorkSession = false;
				if (workSessions.length > 0) {
					var now     = moment();
					var endTime = moment(workSessions[0].endTime).add(1, 'minutes');
					if (endTime > now) {
						openWorkSession = workSessions[0];
					}
				}

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
							openWorkSession,
							SlackUserId,
							shouldStartNewDay,
							dailyTasks,
							isBackDecision: false // what user wants to do
						}

						var name = user.nickName || user.email;

						// give response based on state user is in
						var message = `Hey, ${name}!`;
						if (shouldStartNewDay) {
							if (dailyTasks.length > 0) {
								message = `${message} Here are your priorities from our last time together:\n${taskListMessage}`;
							}
							convo.say(message);
							shouldStartNewDayFlow(err, convo);
						} else {

							if (dailyTasks.length > 0) {
								if (!openWorkSession) {
									// only show tasks when not in a session
									message = `${message} Here are your current priorities:\n${taskListMessage}`;
								}
							}

							convo.say(message);

							if (openWorkSession) {
								openWorkSession.getDailyTasks({
									include: [ models.Task ]
								})
								.then((dailyTasks) => {

									var now           = moment();
									var endTime       = moment(openWorkSession.endTime);
									var endTimeString = endTime.format("h:mm a");
									var minutes       = Math.round(moment.duration(endTime.diff(now)).asMinutes());
									var minutesString = convertMinutesToHoursString(minutes);

									var dailyTaskTexts = dailyTasks.map((dailyTask) => {
										return dailyTask.dataValues.Task.text;
									})

									var sessionTasks = commaSeparateOutTaskArray(dailyTaskTexts);
									convo.say(`You're currently in a session for ${sessionTasks} until *${endTimeString}* (${minutesString} left)`);

									currentlyInSessionFlow(err, convo);
									convo.next();
								})
							} else {
								shouldStartSessionFlow(err, convo);
							}
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

							const { isBackDecision, isBack: { dailyTasksToWorkOn } } = convo;

							var config = { SlackUserId };
							if (convo.status == 'completed') {
								switch (isBackDecision) {
									case intentConfig.START_DAY:
										controller.trigger(`begin_day_flow`, [ bot, config ]);
										break;
									case intentConfig.START_SESSION:
										if (dailyTasksToWorkOn) {
											config.dailyTasksToWorkOn = dailyTasksToWorkOn;
										}
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
									case intentConfig.EDIT_TASKS:
										config.intent = intentConfig.EDIT_TASKS;
										controller.trigger(`new_session_group_decision`, [ bot, config ]);
										break;
									case intentConfig.ADD_TASK:
										config.intent = intentConfig.ADD_TASK;
										controller.trigger(`new_session_group_decision`, [ bot, config ]);
										break;
									case intentConfig.END_SESSION:
										controller.trigger(`done_session_flow`, [ bot, config ]);
										break;
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

	});

};

// user should start a new day
function shouldStartNewDayFlow(err, convo) {

	const { dailyTasks }    = convo.isBack;
	const { task: { bot } } = convo;

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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say(`Okay! I'll be here whenever you're ready to \`plan\` :hand:`);
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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say(`Let's do it!`);
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.startDay.value
			pattern: utterances.specificYes,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

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

// user is currently in a session
function currentlyInSessionFlow(err, convo) {

	var { isBack: { dailyTasks } } = convo;
	const { task: { bot } }        = convo;

	convo.ask({
		text: `*What would you like to do?*`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "IS_BACK_IN_SESSION",
				fallback: "What would you like to do?",
				actions: [
					{
							name: buttonValues.endSessionYes.name,
							text: "End session :punch:",
							value: buttonValues.endSessionYes.value,
							type: "button"
					},
					{
							name: buttonValues.editTaskList.name,
							text: "Edit tasks :memo:",
							value: buttonValues.editTaskList.value,
							type: "button"
					},
					{
							name: buttonValues.startDay.name,
							text: "New Plan",
							value: buttonValues.startDay.value,
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
		{
			pattern: buttonValues.endDay.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.END_DAY;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.endDay.value
			pattern: utterances.endDay,
			callback: function(response, convo) {

				// this comes first because must include both "end" and "day"
				// (as opposed to "end" for end session)

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say(`It's about that time, isn't it?`);
				convo.isBackDecision = intentConfig.END_DAY;
				convo.next();
			}
		},
		{
			pattern: buttonValues.endSessionYes.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.END_SESSION;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.doneSessionYes.value
			pattern: utterances.containsEnd,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.isBackDecision = intentConfig.END_SESSION;
				convo.next();
			}
		},
		{
			pattern: buttonValues.editTaskList.value,
			callback: function(response, convo) {
				convo.isBackDecision = intentConfig.EDIT_TASKS;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.doneSessionYes.value
			pattern: utterances.containsEditTaskList,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.isBackDecision = intentConfig.EDIT_TASKS;
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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say(`Let's do it!`);
				convo.isBackDecision = intentConfig.START_DAY;
				convo.next();
			}
		},
		{ 
			pattern: buttonValues.neverMind.value,
			callback: (response, convo) => {
				convo.say(`I'll be here whenever you call :smile_cat:`);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.neverMind.value
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say(`Okay! I'll be here whenever you call :smile_cat:`);
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

	var { isBack: { dailyTasks } } = convo;
	const { task: { bot } }        = convo;

	convo.ask({
		text: `*Ready to start another session?* \`i.e. lets do task 2\``,
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
		{ // if user lists tasks, we can infer user wants to start a specific session
			pattern: utterances.containsNumber,
			callback: (response, convo) => {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				var tasksToWorkOnString      = response.text;
				var taskNumbersToWorkOnArray = convertTaskNumberStringToArray(tasksToWorkOnString, dailyTasks);

				if (!taskNumbersToWorkOnArray) {
					convo.say("You didn't pick a valid task to work on :thinking_face:");
					convo.say("You can pick a task from your list `i.e. tasks 1, 3` to work on");
					shouldStartSessionFlow(response, convo);
					return;
				}

				var dailyTasksToWorkOn = [];
				dailyTasks.forEach((dailyTask, index) => {
					var taskNumber = index + 1; // b/c index is 0-based
					if (taskNumbersToWorkOnArray.indexOf(taskNumber) > -1) {
						dailyTasksToWorkOn.push(dailyTask);
					}
				});

				convo.isBack.dailyTasksToWorkOn = dailyTasksToWorkOn;
				convo.isBackDecision            = intentConfig.START_SESSION;

				convo.next();
			}
		},
		{ // user does not want any of the options
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say(`Okay! I'll be here whenever you're ready to \`start a session\` :hand:`);
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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.isBackDecision = intentConfig.START_SESSION;
				convo.next();
			}
		},
		{
			pattern: buttonValues.createReminder.value,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.isBackDecision = intentConfig.REMINDER;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.createReminder.value
			pattern: utterances.containsCheckin,
			callback: function(response, convo) {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

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

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

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

							resumeQueuedReachouts(bot, { SlackUserId });

						}

					});

				} else {

					user.getDailyTasks({
						where: [`"DailyTask"."type" = ? AND "Task"."done" = ?`, "live", false],
						include: [models.Task]
					})
					.then((dailyTasks) => {
						if (dailyTasks.length > 0) {
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
					})
				}

			});

		});

}