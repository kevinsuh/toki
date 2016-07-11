import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

import addTaskController from './add';
import completeTasksController from './complete';

import { startEditTaskListMessage } from './editTaskListFunctions';

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
						console.log("\n\n ~ view tasks finished ~ \n\n");
					});
				});

			});

		})

	});

	controller.on(`edit_tasks_flow`, (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;

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
						SlackUserId,
						dailyTasks,
						updateTaskListMessageObject: {},
						newTasks: [],
						dailyTaskIdsToDelete: [],
						dailyTaskIdsToComplete: [],
						dailyTasksToUpdate: [] // existing dailyTasks
					}

					if (dailyTasks.length == 0) {
						convo.say("Looks like you don't have any tasks for today!");
						convo.say("Let me know if you want to `start your day` or `add tasks` to an existing day :memo:");
					} else {
						// this is the flow you expect for editing tasks
						startEditTaskListMessage(convo);
					}
					convo.on('end', (convo) => {
						console.log("\n\n ~ edit tasks finished ~ \n\n");
						console.log(convo.tasksEdit);
						
						var { newTasks, dailyTasks, SlackUserId, dailyTaskIdsToDelete, dailyTaskIdsToComplete, dailyTasksToUpdate } = convo.tasksEdit;

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
							return models.DailyTask.update({
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
								});

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

					});
				});

			});

		})

	});

	controller.hears(['daily_tasks', 'completed_task'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;
		var channel       = message.channel;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
			controller.trigger(`edit_tasks_flow`, [ bot, { SlackUserId } ]);
		}, 1000);

	});

};