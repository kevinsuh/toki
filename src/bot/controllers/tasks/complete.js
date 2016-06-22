import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

// completed task controller
export default function(controller) {

	controller.hears(['completed_task'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;
		var channel       = message.channel;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		console.log("\n\n\n\n ~~ in completed task ~~ \n\n\n\n");

		setTimeout(() => {
			// find user then get tasks
			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {

				// get only live tasks from start day session group
				// start and end SessionGroup will refresh user's "live" tasks
				user.getDailyTasks({
					where: [`"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live"],
					include: [ models.Task ],
					order: `"DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
					var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

					var name        = user.nickName || user.email;
					var SlackUserId = user.SlackUser.SlackUserId;
					var UserId      = user.id;

					bot.startPrivateConversation ({ user: SlackUserId }, (err, convo) => {

						convo.name = name;
						convo.tasksComplete = {
							completedTasks: []
						};

						console.log("\n\n ~~~ DAILY TASKS IN COMPLETE TASKS ~~ \n\n");
						console.log(dailyTasks);

						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
						convo.tasksComplete.dailyTasks = dailyTasks;

						convo.ask("Did you want to check off some tasks? :heavy_check_mark:", [
							{
								pattern: utterances.yes,
								callback: (response, convo) => {
									askWhichTasksToComplete(response, convo);
									convo.next();
								}
							},
							{
								pattern: utterances.no,
								callback: (response, convo) => {
									convo.say("Oh, never mind then!");
									convo.next();
								}
							}
						]);

						// on finish conversation
		    		convo.on('end', (convo) => {

		    			const { completedTasks } = convo.tasksComplete;

		    			if (convo.status == 'completed') {

		    				if (completedTasks.length > 0) {

		    					// put logic here
									completedTasks.forEach((dailyTask) => {
										console.log("\n\nCompleted Task!:\n\n\n");
										console.log(dailyTask);
										console.log("\n\n\n\n");
										const { dataValues } = dailyTask;
										if (dataValues) {
											const { id } = dataValues;
											models.DailyTask.find({
												where: { id },
												include: [ models.Task ]
											})
											.then((dailyTask) => {
												var task = dailyTask.Task;
												return task.update({
													done: true
												})
											})
											.then((task) => {

												models.DailyTask.findAll({
													where: [`"Task"."done" = ? AND "DailyTask"."type" = ? AND "DailyTask"."UserId" = ?`, false, "live", UserId],
													include: [ models.Task ]
												})
												.then((dailyTasks) => {
													bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

														dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
														var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

														convo.say("Here's what your outstanding tasks look like:");
														convo.say(taskListMessage);
														convo.next();

													});
												});

											})
										}
									});

									
									
		    				}

		    			} else {
		    				// default premature end
								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
									convo.say("Okay! Exiting now. Let me know when you want to start your day!");
									convo.next();
								});
		    			}
		    		});
					});

				});
			})
		}, 1000);
	});
};

// ask which tasks to complete
function askWhichTasksToComplete(response, convo) {

	const { dailyTasks } = convo.tasksComplete;
	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	convo.say("Which task(s) did you get done? Just write which number(s) like `3, 4, 1`");
	convo.ask(taskListMessage, (response, convo) => {

		var initialCompleteTaskNumbers = response.text;
		const { dailyTasks } = convo.tasksComplete;

		// either a non-number, or number > length of tasks
		var isInvalid = false;
		var nonNumberTest = new RegExp(/\D/);
		initialCompleteTaskNumbers = initialCompleteTaskNumbers.split(",").map((order) => {
			order = order.trim();
			var orderNumber = parseInt(order);
			if (nonNumberTest.test(order) || orderNumber > dailyTasks.length)
				isInvalid = true;
			return orderNumber;
		});

		if (isInvalid) {
			convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:");
		} else {
			convo.say("Great work :punch:");
			var completeTaskNumberList = [];
			initialCompleteTaskNumbers.forEach((order => {
				if (order > 0) {
					order--; // 0-index based
					completeTaskNumberList.push(order);
				}
			}));

			var completedTaskArray = [];
			completeTaskNumberList.forEach((order) => {
				completedTaskArray.push(dailyTasks[order]);
			});

			convo.tasksComplete.completedTasks = completedTaskArray;

		}

		convo.next();

	});
}