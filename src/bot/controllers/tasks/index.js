import os from 'os';
import { wit, bots } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertStringToNumbersArray, commaSeparateOutTaskArray } from '../../lib/messageHelpers';
import { prioritizeDailyTasks } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';
import { TASK_DECISION } from '../../lib/constants';

import addTaskController from './add';
import completeTasksController from './complete';
import { checkWorkSessionForLiveTasks } from '../work_sessions';

import { startEditTaskListMessage } from './editTaskListFunctions';

import { resumeQueuedReachouts } from '../index';

// base controller for tasks
export default function(controller) {

	addTaskController(controller);
	completeTasksController(controller);

	/**
	 * 		YOUR DAILY TASKS
	 */
	
	controller.on(`view_daily_tasks_flow`, (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			user.getDailyTasks({
				where: [`"DailyTask"."type" = ?`, "live"],
				include: [ models.Task ],
				order: `"Task"."done", "DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
					var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

					if (dailyTasks.length == 0) {
						convo.say("Looks like you don't have any tasks for today!");
						convo.say("Let me know if you want to `start your day` or `add tasks` to an existing day :memo:");
					} else {
						convo.say("Here are your tasks for today :memo::");
						convo.say(taskListMessage);
					}
					convo.on('end', (convo) => {
						prioritizeDailyTasks(user);
						resumeQueuedReachouts(bot, { SlackUserId });
						console.log("\n\n ~ view tasks finished ~ \n\n");
					});
				});

			});

		})

	});

	controller.on(`edit_tasks_flow`, (bot, config) => {

		const { SlackUserId, taskNumbers, taskDecision, message } = config;

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
					where: [`"DailyTask"."type" = ?`, "live"],
					include: [ models.Task ],
					order: `"Task"."done", "DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

						convo.tasksEdit = {
							bot,
							tz,
							SlackUserId,
							dailyTasks,
							updateTaskListMessageObject: {},
							newTasks: [],
							dailyTaskIdsToDelete: [],
							dailyTaskIdsToComplete: [],
							dailyTasksToUpdate: [], // existing dailyTasks
							openWorkSession,
							taskDecision,
							taskNumbers,
							changePlanCommand: {
								decision: false
							}
						}

						// if you are changing between commands, we will
						// store that information and have special config ability
						if (config.changePlanCommand && config.changePlanCommand.decision) {
							convo.tasksEdit.changedPlanCommands = true;
						}

						// this is the flow you expect for editing tasks
						startEditTaskListMessage(convo);

						
						convo.on('end', (convo) => {
							
							var { newTasks, dailyTasks, SlackUserId, dailyTaskIdsToDelete, dailyTaskIdsToComplete, dailyTasksToUpdate, startSession, dailyTasksToWorkOn, changePlanCommand } = convo.tasksEdit;

							console.log(convo.tasksEdit.changePlanCommand);

							// this means we are changing the plan!
							if (changePlanCommand.decision) {
								let message = { text: changePlanCommand.text };
								let config = { SlackUserId, message, changePlanCommand }
								controller.trigger(`plan_command_center`, [ bot, config ]);
								return;
							}

							resumeQueuedReachouts(bot, { SlackUserId });

							if (startSession && dailyTasksToWorkOn && dailyTasksToWorkOn.length > 0) {
								var config = {
									SlackUserId,
									dailyTasksToWorkOn
								}
								config.intent = intentConfig.START_SESSION;
								controller.trigger(`new_session_group_decision`, [ bot, config ]);
								return;
							}

							// add new tasks if they got added
							if (newTasks.length > 0) {
								var priority = dailyTasks.length;
								// add the priorities
								newTasks = newTasks.map((newTask) => {
									priority++;
									return {
										...newTask,
										priority
									};
								});

								newTasks.forEach((newTask) => {
									const { minutes, text, priority } = newTask;
									if (minutes && text) {
										models.Task.create({
											text
										})
										.then((task) => {
											const TaskId = task.id;
											models.DailyTask.create({
												TaskId,
												priority,
												minutes,
												UserId
											});
										});
									}
								})
							}

							// delete tasks if requested
							if (dailyTaskIdsToDelete.length > 0) {
								models.DailyTask.update({
									type: "deleted"
								}, {
									where: [`"DailyTasks"."id" in (?)`, dailyTaskIdsToDelete]
								})
							}

							// complete tasks if requested
							if (dailyTaskIdsToComplete.length > 0) {
								models.DailyTask.findAll({
									where: [`"DailyTask"."id" in (?)`, dailyTaskIdsToComplete],
									include: [models.Task]
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
								})
							}

							// update daily tasks if requested
							if (dailyTasksToUpdate.length > 0) {
								dailyTasksToUpdate.forEach((dailyTask) => {
									if (dailyTask.dataValues && dailyTask.minutes && dailyTask.text) {
										const { minutes, text } = dailyTask;
										models.DailyTask.update({
											text,
											minutes
										}, {
											where: [`"DailyTasks"."id" = ?`, dailyTask.dataValues.id]
										})
									}
								})
							}

							setTimeout(() => {

								setTimeout(() => {
									prioritizeDailyTasks(user);
								}, 1000);

								// only check for live tasks if SOME action took place
								if (newTasks.length > 0 || dailyTaskIdsToDelete.length > 0 || dailyTaskIdsToComplete.length > 0 || dailyTasksToUpdate.length > 0) {
									checkWorkSessionForLiveTasks({ SlackUserId, bot, controller });
								}
							}, 750);

						});
					});
				});
			})
		})
	});

	/**
	 * 		UNDO COMPLETE OR DELETE OF TASKS
	 */
	controller.on(`undo_task_complete`, (bot, config) => {

		const { SlackUserId, botCallback, payload } = config;

		let dailyTaskIdsToUnComplete = [];
		if (payload.actions[0]) {
			let dailyTaskIdsString = payload.actions[0].name;
			dailyTaskIdsToUnComplete = dailyTaskIdsString.split(",");
		}

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
			const { SlackUser: { tz } } = user;

			user.getDailyTasks({
				where: [`"DailyTask"."id" IN (?)`, dailyTaskIdsToUnComplete],
				include: [ models.Task ]
			})
			.then((dailyTasks) => {

				let count = 0;
				dailyTasks.forEach((dailyTask) => {
					dailyTask.dataValues.Task.update({
						done: false
					});
					count++;
					if (count == dailyTasks.length) {
						setTimeout(() => {
							prioritizeDailyTasks(user);
						}, 750);
					}
				})

				let dailyTaskTexts = dailyTasks.map((dailyTask) => {
					let text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
					return text;
				});
				let dailyTasksString = commaSeparateOutTaskArray(dailyTaskTexts);

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					if (dailyTaskTexts.length == 1) {
						convo.say(`Okay! I unchecked ${dailyTasksString}. Good luck with that task!`);
					} else {
						convo.say(`Okay! I unchecked ${dailyTasksString}. Good luck with those tasks!`);
					}

				});

			});

		})
	});

	/**
	 * 		UNDO COMPLETE OR DELETE OF TASKS
	 */
	controller.on(`undo_task_delete`, (bot, config) => {

		const { SlackUserId, botCallback, payload } = config;

		let dailyTaskIdsToUnDelete = [];
		if (payload.actions[0]) {
			let dailyTaskIdsString = payload.actions[0].name;
			dailyTaskIdsToUnDelete = dailyTaskIdsString.split(",");
		}

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
			const { SlackUser: { tz } } = user;

			user.getDailyTasks({
				where: [`"DailyTask"."id" IN (?)`, dailyTaskIdsToUnDelete],
				include: [ models.Task ]
			})
			.then((dailyTasks) => {

				let count = 0;
				dailyTasks.forEach((dailyTask) => {
					dailyTask.update({
						type: "live"
					});
					count++;
					if (count == dailyTasks.length) {
						setTimeout(() => {
							prioritizeDailyTasks(user);
						}, 750);
					}
				})

				let dailyTaskTexts = dailyTasks.map((dailyTask) => {
					let text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
					return text;
				});
				let dailyTasksString = commaSeparateOutTaskArray(dailyTaskTexts);

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					if (dailyTaskTexts.length == 1) {
						convo.say(`Okay! I undeleted ${dailyTasksString}. Good luck with that task!`);
					} else {
						convo.say(`Okay! I undeleted ${dailyTasksString}. Good luck with those tasks!`);
					}

				});

			});

		})
	});

	controller.hears(['daily_tasks', 'add_daily_task', 'completed_task'], 'direct_message', wit.hears, (bot, message) => {

		const { text, channel } = message;
		const SlackUserId       = message.user;

		let config = { SlackUserId, message };

		// wit may pick up "add check in" as add_daily_task
		if (utterances.startsWithAdd.test(text) && utterances.containsCheckin.test(text)) {
			if (utterances.containsOnlyCheckin.test(text)){
				config.reminder_type = "work_session";
			}
			controller.trigger(`ask_for_reminder`, [ bot, config ]);
			return;
		};		

		controller.trigger(`plan_command_center`, [ bot, config ]);

	});

	/**
	 * 		This is where the message command goes to decide
	 * 		What happens with your plan, what data we show
	 * 		i.e. what specific customization config to displaying PLAN module.
	 */
	controller.on(`plan_command_center`, (bot, config) => {

		console.log("\n\n\n ~~ In Plan Command Center ~~ \n\n\n");

		const { message, message: { text }, SlackUserId, botCallback } = config;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			let botToken = bot.config.token;
			bot          = bots[botToken];
		}

		let taskNumbers = convertStringToNumbersArray(text);
		if (taskNumbers) {
			config.taskNumbers = taskNumbers;
		}

		// this is how you make switch/case statements with RegEx
		switch (text) {
			case (text.match(TASK_DECISION.complete.reg_exp) || {}).input:
				console.log(`\n\n ~~ User wants to complete task ~~ \n\n`);
				config.taskDecision = TASK_DECISION.complete.word;
				break;
			case (text.match(TASK_DECISION.add.reg_exp) || {}).input:
				console.log(`\n\n ~~ User wants to add task ~~ \n\n`);
				config.taskDecision = TASK_DECISION.add.word;
				break;
			case (text.match(TASK_DECISION.view.reg_exp) || {}).input:
				console.log(`\n\n ~~ User wants to view task ~~ \n\n`);
				config.taskDecision = TASK_DECISION.view.word;
				break;
			case (text.match(TASK_DECISION.delete.reg_exp) || {}).input:
				console.log(`\n\n ~~ User wants to delete task ~~ \n\n`);
				config.taskDecision = TASK_DECISION.delete.word;
				break;
			case (text.match(TASK_DECISION.edit.reg_exp) || {}).input:
				console.log(`\n\n ~~ User wants to edit task ~~ \n\n`);
				config.taskDecision = TASK_DECISION.edit.word;
				break;
			case (text.match(TASK_DECISION.work.reg_exp) || {}).input:
				console.log(`\n\n ~~ User wants to work on task ~~ \n\n`);
				config.taskDecision = TASK_DECISION.work.word;
				break;
			default: 
				config.taskDecision = TASK_DECISION.view.word;
				break;
		}

		/**
		 * 	For `edit_tasks_flow`, config must have taskDecision.
		 * 	if taskNumbers exists, allows for single-line command
		 */

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			controller.trigger(`edit_tasks_flow`, [ bot, config ]);
		}, 1000);

	});


};