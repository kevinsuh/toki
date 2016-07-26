import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';
import moment from 'moment-timezone';

import endWorkSessionController from './endWorkSession';
import endWorkSessionTimeoutsController from './endWorkSessionTimeouts';
import startWorkSessionController from './startWorkSession';
import sessionOptionsController from './sessionOptions';

import intentConfig from '../../lib/intents';
import { hoursForExpirationTime, startDayExpirationTime, colorsArray, buttonValues, colorsHash, startSessionOptionsAttachments, pausedSessionOptionsAttachments, TASK_DECISION } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertMinutesToHoursString, deleteConvoAskMessage, convertTaskNumberStringToArray } from '../../lib/messageHelpers';
import { utterances } from '../../lib/botResponses';

import { askUserPostSessionOptions, handlePostSessionDecision } from './endWorkSession';

import { resumeQueuedReachouts } from '../index';

// base controller for work sessions!
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startWorkSessionController(controller);
	sessionOptionsController(controller);
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
						controller.trigger(`is_back_flow`, [ bot, config ]);

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
				where: [`"open" = ?`, true],
				order: `"WorkSession"."createdAt" DESC`
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
						let message = `Hey, ${name}!`;

						if (openWorkSession) {

							// send either a pause or a live session reminder
							openWorkSession.getStoredWorkSession({
								where: [ `"StoredWorkSession"."live" = ?`, true ]
							})
							.then((storedWorkSession) => {
								openWorkSession.getDailyTasks({
									include: [ models.Task ]
								})
								.then((dailyTasks) => {

									let now           = moment();
									let endTime       = moment(openWorkSession.endTime);
									let endTimeString = endTime.format("h:mm a");
									let minutes       = Math.round(moment.duration(endTime.diff(now)).asMinutes());
									let minutesString = convertMinutesToHoursString(minutes);

									let dailyTaskTexts = dailyTasks.map((dailyTask) => {
										return dailyTask.dataValues.Task.text;
									});

									let sessionTasks = commaSeparateOutTaskArray(dailyTaskTexts);

									convo.isBack.currentSession = {
										endTime,
										endTimeString,
										minutesString
									}

									if (storedWorkSession) {

										minutes       = storedWorkSession.dataValues.minutes;
										minutesString = convertMinutesToHoursString(minutes);

										// currently paused
										message = `${message} Your session is still paused :double_vertical_bar: You have *${minutesString}* remaining for ${sessionTasks}`;
										convo.say(message);
										convo.say({
											text: `*What would you like to do?*`,
											attachments: pausedSessionOptionsAttachments
										});
									} else {
										// currently live
										message = `${message} You're currently in a session for ${sessionTasks} until *${endTimeString}* (${minutesString} left)`;
										convo.say(message);
										currentlyInSessionFlow(err, convo);
									}

									convo.next();

								})
							});

						} else {

							// no currently open sessions
							if (shouldStartNewDay) {
								// start new day!
								if (dailyTasks.length > 0) {
									message = `${message} Here are your priorities from our last time together:\n${taskListMessage}`;
								}
								convo.say(message);
								shouldStartNewDayFlow(err, convo);
							} else {
								// start new session!
								if (dailyTasks.length > 0) {
									message = `${message} Here are your current priorities:\n${taskListMessage}`;
								}
								convo.say(message);
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
		message = `${message} If the above tasks are what you want to work on, we can start a session instead \`i.e. lets do task 2\` :pick:`;
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
					shouldStartNewDayFlow(response, convo);
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

				convo.say(`Okay! I'll be here whenever you're ready to \`plan\` :wave:`);
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
							name: buttonValues.doneSessionEarlyNo.name,
							text: "Continue Session",
							value: buttonValues.doneSessionEarlyNo.value,
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
		{ // continue session
			pattern: buttonValues.doneSessionEarlyNo.value,
			callback: (response, convo) => {

				var message = `Keep crushing :muscle:`
				var { isBack: { currentSession } } = convo;
				if (currentSession && currentSession.endTimeString)
					message = `I'll see you at *${currentSession.endTimeString}*! ${message}`;

				convo.say(message);
				convo.next();
			}
		},
		{ // same as buttonValues.doneSessionNo.value
			pattern: utterances.containsContinue,
			callback: (response, convo) => {

				// delete button when answered with NL
				deleteConvoAskMessage(response.channel, bot);

				convo.say(`Got it`);
				var message = `Keep crushing :muscle:`
				var { isBack: { currentSession } } = convo;
				if (currentSession && currentSession.endTimeString)
					message = `I'll see you at *${currentSession.endTimeString}*! ${message}`;

				convo.say(message);
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
			const { SlackUser: { tz }, defaultBreakTime } = user;

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
										SlackUserId,
										defaultBreakTime
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
							let minutes       = moment.duration(endTime.diff(now)).asMinutes();
							let minutesString = convertMinutesToHoursString(minutes);

							// send either a pause or a live session reminder
							openWorkSession.getStoredWorkSession({
								where: [ `"StoredWorkSession"."live" = ?`, true ]
							})
							.then((storedWorkSession) => {
								if (storedWorkSession) {

									// currently paused
									minutes       = storedWorkSession.dataValues.minutes;
									minutesString = convertMinutesToHoursString(minutes);
									bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

										convo.say({
											text: `Let me know when you want to resume your session for ${liveTasksString}!`,
											attachments: pausedSessionOptionsAttachments
										});

									});
								} else {
									// currently live
									bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

										convo.say(`Good luck with ${liveTasksString}!`);
										convo.say({
											text: `See you in ${minutesString} at *${endTimeString}* :timer_clock:`,
											attachments: startSessionOptionsAttachments
										});

									});
								}
							});

							resumeQueuedReachouts(bot, { SlackUserId });

						}

					});

				} else {

					if (false) {
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
					
				}

			});

		});

}