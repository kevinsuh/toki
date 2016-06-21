import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertResponseObjectsToTaskArray, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

import { FINISH_WORD } from '../../lib/constants';

// base controller for tasks
export default function(controller) {

	/**
	 * 		User wants to add task
	 * 			as interpreted by ~ Wit.ai ~
	 */
	controller.hears(['add_daily_task'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;
		var intent        = intentConfig.ADD_TASK;
		var channel       = message.channel;

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
	 * 			ADD DAILY TASK FLOW
	 */
	controller.on(`add_task_flow`, (bot, config) => {

		const { SlackUserId } = config;

		// find user then get tasks
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// we need user's task lists since start_day
			const UserId = user.id;

			user.getSessionGroups({
				order: `"SessionGroup"."createdAt" DESC`,
				limit: 1
			})
			.then((sessionGroups) => {

				// should start day

	      const startSessionGroup   = sessionGroups[0]; // the start day
				var startSessionGroupTime = startSessionGroup.dataValues.createdAt;

				user.getDailyTasks({
					where: [`"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?`, startSessionGroupTime, false, "live"],
					include: [ models.Task ],
					order: `"DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					var name   = user.nickName || user.email;
					var SlackUserId = user.SlackUser.SlackUserId;

					bot.startPrivateConversation ({ user: SlackUserId }, (err, convo) => {

						convo.name = name;
						convo.tasksAdd = {
							SlackUserId
						};

						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
						convo.tasksAdd.dailyTasks   = dailyTasks;

						askForNewTasksToAdd(err, convo);

						// on finish conversation
		    		convo.on('end', (convo) => {

		    			console.log("\n\n\n\n ~~ convo ended in add tasks ~~ \n\n\n\n");

		  				var responses = convo.extractResponses();
		  				const { tasksAdd } = convo;

		    			if (convo.status == 'completed') {

		    				// prioritized task array is the one we're ultimately going with
		    				const { dailyTasks, prioritizedTaskArray } = tasksAdd;

		    				// we're going to archive all existing daily tasks first by default, then re-update the ones that matter
		    				dailyTasks.forEach((dailyTask) => {
		    					const { id } = dailyTask.dataValues;
		    					console.log(`\n\n\nupdating daily task id: ${id}\n\n\n`);
		    					models.DailyTask.update({
		    						type: "archived"
		    					},{
		    						where: { id }
		    					});
		    				});

		    				// store the user's tasks
		    				// existing dailyTasks: update to new obj (esp. `priority`)
		    				// new dailyTasks: create new obj
		    				prioritizedTaskArray.forEach((dailyTask, index) => {

		    					const { dataValues } = dailyTask;
		    					var newPriority = index + 1;
		    					
		    					if (dataValues) {

			    					console.log("\n\nexisting daily task:\n\n\n");
			    					console.log(dailyTask.dataValues);
			    					console.log(`user id: ${UserId}`);
			    					console.log("\n\n\n\n")

		    						// existing daily task and make it live
		    						const { id, minutes } = dataValues;
		    						models.DailyTask.update({
		    							minutes,
		    							UserId,
		    							priority: newPriority,
		    							type: "live"
		    						}, {
		    							where: { id }
		    						});

		    					} else {

		    						console.log("\n\n new daily task:\n\n\n");
			    					console.log(dailyTask);
			    					console.log(`user id: ${UserId}`);
			    					console.log("\n\n\n\n")

		    						// new task
		    						const { text, minutes } = dailyTask;
		    						models.Task.create({
		    							text
		    						})
		    						.then((task) => {
		    							models.DailyTask.create({
		    								TaskId: task.id,
		    								priority: newPriority,
		    								minutes,
		    								UserId
		    							})
		    						});
		    					}

		    				})

		    			} else {

		    				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
									convo.say("Okay! I'll be here whenever you're ready :smile:");
									convo.next();
								});
			    				
		    			}
		    		});
					});
				});
			});
		});
	});

};

// user adds new tasks here
function askForNewTasksToAdd(response, convo) {

	const { task, name }          = convo;
	const { bot, source_message } = task;
	var { dailyTasks }            = convo.tasksAdd;

	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	if (dailyTasks.length > 0) {
		convo.say(`Here are the tasks you outlined so far:`);
		convo.say(taskListMessage);
	}
	
	convo.say(`What task(s) would you like to add to your list? :pencil:`);
	convo.say(`You can enter everything in one line, separated by commas, or send me each task in a separate line`);

	convo.ask(`Then just tell me when you're done by saying \`${FINISH_WORD.word}\`!`, (response, convo) => {

		if (FINISH_WORD.reg_exp.test(response.text)) {
			askForTimeToTasks(response, convo);
			convo.next();
		}

	}, { 'key' : 'newTasks', 'multiple': true});

}

// ask user to put time to tasks
function askForTimeToTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	var { newTasks }              = convo.responses;

	var newTasksArray            = convertResponseObjectsToTaskArray(newTasks);
	convo.tasksAdd.newTasksArray = newTasksArray;

	var taskListMessage = convertArrayToTaskListMessage(newTasksArray);

	convo.say(`Excellent! Now, how much time would you like to allocate to these new tasks today?`);
	convo.say(taskListMessage);
	getTimeToTasks(response, convo);
}

// actual question for user to give time to tasks
function getTimeToTasks(response, convo) {
	convo.ask("Just say, `30, 40, 50, 1 hour, 15 min` and I'll figure it out and assign those times to the tasks above in order :smiley:", (response, convo) => {
		assignTimeToTasks(response, convo);
		convo.next();
	});
}

// actual work of assigning user response times to task
function assignTimeToTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	var { newTasksArray }  = convo.tasksAdd;

	var timeToTask = response.text;

	// need to check for invalid responses.
	// does not say minutes or hours, or is not right length
	var isInvalid = false;
	timeToTask = timeToTask.split(",");
	if (timeToTask.length != newTasksArray.length) {
		isInvalid = true;
	};

	var validMinutesTester = new RegExp(/[\dh]/);
	timeToTask = timeToTask.map((time) => {
		if (!validMinutesTester.test(time)) {
			isInvalid = true;
		}
		var minutes = convertTimeStringToMinutes(time);
		return minutes;
	});

	newTasksArray = newTasksArray.map((task, index) => {
		return {
			...task,
			minutes: timeToTask[index]
		}
	});

	convo.tasksAdd.newTasksArray = newTasksArray;
	var taskListMessage          = convertArrayToTaskListMessage(newTasksArray);

	// INVALID tester
	if (isInvalid) {
		convo.say("Oops, looks like you didn't put in valid times :thinking_face:. Let's try this again");
		convo.say("Send me the amount of time you'd like to work on each task above, separated by commas. The first time you list will represent the first task above, the second time you list will represent the second task, and on and on");
		convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `2 hours`");
		convo.say(taskListMessage);
		getTimeToTasks(response, convo);
		return;
	}

	convo.say("Are these times right?");
	convo.ask(taskListMessage, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.say(`This looks great. Let's add these to your existing list now`);
				askToPrioritizeList(response, convo);
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say(`Let's give this another try :repeat_one:`);
				convo.say(taskListMessage);
				convo.say(`Send me the amount of time you'd like to work on each task above, separated by commas. The first time you list will represent the first task above, the second time you list will represent the second task, and on and on`);
				convo.ask("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `2 hours`", (response, convo) => {
					assignTimeToTasks(response, convo);
					convo.next();
				});
				convo.next();
			}
		}
	]);

}

// ask to prioritize task list. all existing daily tasks and new ones
function askToPrioritizeList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	// organize the task lists!
	var { dailyTasks, newTasksArray } = convo.tasksAdd;
	var allTasksArray = dailyTasks.slice();
	newTasksArray.forEach((newTask) => {
		allTasksArray.push(newTask);
	});
	convo.tasksAdd.allTasksArray = allTasksArray;

	var taskListMessage = convertArrayToTaskListMessage(allTasksArray);
	convo.say("Please rank your tasks in order of your priorities today");
	convo.say(taskListMessage);
	convo.ask("You can just like the numbers, like `3, 4, 1, 2, 5`", (response, convo) => {
		prioritizeTaskList(response, convo);
		convo.next();
	});

}

// assign the priorities to full task list
// user has just listed `1, 3, 4, 2`
function prioritizeTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	// organize the task lists!
	var { dailyTasks, newTasksArray, allTasksArray } = convo.tasksAdd;
	var allTasksArray = dailyTasks.slice();
	newTasksArray.forEach((newTask) => {
		allTasksArray.push(newTask);
	});

	var initialPriorityOrder = response.text;

	// either a non-number, or number > length of tasks
	var isInvalid = false;
	var nonNumberTest = new RegExp(/\D/);
	initialPriorityOrder = initialPriorityOrder.split(",").map((order) => {
		order = order.trim();
		var orderNumber = parseInt(order);
		if (nonNumberTest.test(order) || orderNumber > allTasksArray.length)
			isInvalid = true;
		return orderNumber;
	});

	if (isInvalid) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		askToPrioritizeList(response, convo);
		return;
	}

	var priorityOrder = [];
	initialPriorityOrder.forEach(function(order) {
		if ( order > 0) {
			order--; // make user-entered numbers 0-index based
			priorityOrder.push(order);
		}
	});

	var prioritizedTaskArray = [];
	priorityOrder.forEach((order) => {
		prioritizedTaskArray.push(allTasksArray[order]);
	});

	var taskListMessage = convertArrayToTaskListMessage(prioritizedTaskArray);

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {

				convo.tasksAdd.prioritizedTaskArray = prioritizedTaskArray;
				const { SlackUserId }               = convo.tasksAdd;

				convo.say("Boom! This looks great");

				// if user has no work sessions started, encourage user to start a session
				models.User.find({
					where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
					include: [
						models.SlackUser
					]
				})
				.then((user) => {
					user.getWorkSessions({
						where: [`"open" = ?`, true ]
					})
					.then((workSessions) => {
						// user should start a session!
						if (workSessions.length == 0) {
							convo.say("Let me know when you're ready to `start a session` :smile_cat:");
						} else {
						// user was just adding tasks in the middle of a session
							convo.say("Let’s get back to it. Good luck finishing the session :fist:");
						}
						convo.next();
					})
				})
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say("Whoops :banana: Let's try to do this again");
				askToPrioritizeList(response, convo);
				convo.next();
			}
		}
	]);


}



