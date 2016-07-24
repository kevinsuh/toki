import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertResponseObjectsToTaskArray, prioritizeTaskArrayFromUserInput, convertTimeStringToMinutes, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { consoleLog, witDurationToTimeZoneObject, witDurationToMinutes } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { FINISH_WORD, buttonValues } from '../../lib/constants';
import { utterances } from '../../lib/botResponses';

import { resumeQueuedReachouts } from '../index';

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

		const { text, intentObject: { entities: { reminder, duration } } } = message;

		if (utterances.startsWithAdd.test(text) && utterances.containsCheckin.test(text)) {
			let config = { SlackUserId, message };
			if (utterances.containsOnlyCheckin.test(text)){
				config.reminder_type = "work_session";
			}
			controller.trigger(`ask_for_reminder`, [ bot, config ]);
			return;
		};

		var userMessage = {
			text,
			reminder,
			duration
		}

		// if the user says tasks (plural), then assume
		// they want to add multiple tasks
		var tasksRegExp = new RegExp(/(\btasks\b)/i);
		if (tasksRegExp.test(text)) {
			intent = intentConfig.EDIT_TASKS;
		}

		var config = {
			intent,
			SlackUserId,
			message: userMessage
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

		const { SlackUserId, message } = config;

		consoleLog("in add task flow", message);

		// if has duration and/or reminder we can autofill
		const { reminder, duration } = message;
		var minutes = false;
		var task    = false;

		// length of task
		if (duration) {
			minutes = witDurationToMinutes(duration);
		}
		// content of task
		if (reminder) {
			task = reminder[0].value;
		}

		// find user then get tasks
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;

			user.getSessionGroups({
				order: `"SessionGroup"."createdAt" DESC`,
				limit: 1
			})
			.then((sessionGroups) => {

				if (sessionGroups.length == 0 || sessionGroups[0].dataValues.type == "end_work") {
					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
						convo.say("Hey! You haven't `started a day` yet, let's do that first");
						convo.next();
					});
					resumeQueuedReachouts(bot, { SlackUserId });
					return;
				}

				// should start day
				const startSessionGroup = sessionGroups[0];

				user.getDailyTasks({
					where: [`"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?`, startSessionGroup.dataValues.createdAt, false, "live"],
					include: [ models.Task ],
					order: `"DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					var name   = user.nickName || user.email;
					var SlackUserId = user.SlackUser.SlackUserId;

					bot.startPrivateConversation ({ user: SlackUserId }, (err, convo) => {

						convo.tasksAdd = {
							SlackUserId,
							minutes,
							task
						};

						getTaskContent(err, convo);

						// on finish conversation
						convo.on('end', (convo) => {

							const { tasksAdd: { task, minutes, editTaskList } } = convo;

							if (convo.status == 'completed') {

								// if we have the task and minutes, let's add it
								if (task && minutes) {

									var newPriority = dailyTasks.length + 1;
									models.Task.create({
										text: task
									})
									.then((task) => {
										models.DailyTask.create({
											TaskId: task.id,
											priority: newPriority,
											minutes,
											UserId
										})
										.then(() => {
											// if user added a task, then we need to edit task list flow after creation
											if (editTaskList) {
												controller.trigger(`edit_tasks_flow`, [ bot, { SlackUserId } ]);
											} else {
												controller.trigger(`view_daily_tasks_flow`, [ bot, { SlackUserId } ]);
											}
										})
									});

								} else {
									// if user did not add a task, then we can go straight to editing task list
									if (editTaskList) {
										controller.trigger(`edit_tasks_flow`, [ bot, { SlackUserId } ]);
									} else {
										resumeQueuedReachouts(bot, { SlackUserId });
									}
								}

							} else {

								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
									convo.say("Okay! I didn't add any tasks. I'll be here whenever you want to do that :smile:");
									convo.next();
								});
								resumeQueuedReachouts(bot, { SlackUserId });
								
							}
						});
					});

				});
			});
		});
	});

};

/**
 * 			~~ START OF SINGLE TASK ADD FLOW ~~
 */

function getTaskContent(response, convo) {

	const { task, minutes } = convo.tasksAdd;

	if (task) {
		// task has been filled and we can move on
		
		// hack to handle wit problems
		if (!minutes && ((utterances.containsTask.test(task) && task.length < 7) || utterances.startsWithAdd.test(task)) || (utterances.containsAdd.test(task) && utterances.containsTask.test(task)) ) {
			askForTask(response, convo);
		} else {
			getTaskMinutes(response, convo);
		}

	} else {
		askForTask(response, convo);
	}

}

function askForTask(response, convo) {
	convo.ask(`What is the task? \`i.e. add email market report for 30 min\``, (response, convo) => {

		const { text, intentObject: { entities } } = response;

		convo.tasksAdd.task = text;

		// shortcut add minutes if user uses single line
		// `i.e. email market report for 30 min`
		if (entities.duration && entities.reminder) {
			var minutes            = witDurationToMinutes(entities.duration);
			var task               = entities.reminder[0].value;
			convo.tasksAdd.minutes = minutes;
			convo.tasksAdd.task    = task;
		}

		getTaskMinutes(response, convo);
		convo.next();
	})
}

function getTaskMinutes(response, convo) {

	const { minutes } = convo.tasksAdd;

	if (minutes) {
		// minutes has been filled and we can move on
		confirmTaskToAdd(response, convo);
	} else {
		convo.ask(`How long will this task take?`, (response, convo) => {

			const { text } = response;
			var validMinutesTester = new RegExp(/[\dh]/);
			if (validMinutesTester.test(text)) {
				var minutes = convertTimeStringToMinutes(text);
				convo.tasksAdd.minutes = minutes;
				confirmTaskToAdd(response, convo);
			} else {
				convo.say("Oops, I didn't quite get that. Let me know duration like `30 min` or `1 hour`");
				convo.repeat();
			}
			convo.next();

		});
	}

}

// confirm here to add the task
function confirmTaskToAdd(response, convo) {

	const { task, minutes } = convo.tasksAdd;
	var timeString = convertMinutesToHoursString(minutes);

	convo.ask({
		text: `Does this look good? If so, I'll add \`${task} (${timeString})\` to your tasks`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "CONFIRM_TASK_ADD",
				fallback: "Does this task look good?",
				actions: [
					{
							name: buttonValues.addTask.name,
							text: "Yes!",
							value: buttonValues.addTask.value,
							type: "button",
							style: "primary"
					},
					{
							name: buttonValues.changeTaskContent.name,
							text: "Change task",
							value: buttonValues.changeTaskContent.value,
							type: "button"
					},
					{
							name: buttonValues.changeTaskTime.name,
							text: "Change time",
							value: buttonValues.changeTaskTime.value,
							type: "button"
					},
					{
							name: buttonValues.editTaskList.name,
							text: "Yes + View tasks",
							value: buttonValues.editTaskList.value,
							type: "button"
					},
					{
							name: buttonValues.neverMind.name,
							text: "Never mind",
							value: buttonValues.neverMind.value,
							type: "button"
					}
				]
			}
		]
	},
	[
		{
			pattern: buttonValues.addTask.value,
			callback: function(response, convo) {
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.addTask.value
			pattern: utterances.yes,
			callback: function(response, convo) {
				convo.say(`Added! Keep at it :muscle:`);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeTaskContent.value,
			callback: function(response, convo) {
				convo.tasksAdd.task = false;
				getTaskContent(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.changeTaskContent.value
			pattern: utterances.containsChangeTask,
			callback: function(response, convo) {
				convo.say("Okay!");
				convo.tasksAdd.task = false;
				getTaskContent(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.changeTaskTime.value,
			callback: function(response, convo) {
				convo.tasksAdd.minutes = false;
				getTaskMinutes(response, convo);
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.changeTaskTime.value
			pattern: utterances.containsChangeTime,
			callback: function(response, convo) {
				convo.say("Okay!");
				convo.tasksAdd.minutes = false;
				getTaskMinutes(response, convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.editTaskList.value,
			callback: function(response, convo) {
				convo.say("I added this task too :grin:");
				convo.tasksAdd.editTaskList = true;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.editTaskList.value
			pattern: utterances.containsEditTaskList,
			callback: function(response, convo) {
				convo.say("Okay! I added your task :grin:. Let's edit your task list");
				convo.next();
			}
		},
		{
			pattern: buttonValues.neverMind.value,
			callback: function(response, convo) {
				convo.say("Let's back to it!");
				convo.tasksAdd.minutes = false;
				convo.tasksAdd.task    = false;
				convo.next();
			}
		},
		{ // NL equivalent to buttonValues.editTaskList.value
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {
				convo.say("Okay, I didn't add any tasks. Let's back to it!");
				convo.tasksAdd.minutes = false;
				convo.tasksAdd.task    = false;
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


/**
 * 			~~ END OF SINGLE TASK ADD FLOW ~~
 */

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

	// if no tasks added, quit!
	if (newTasksArray.length == 0) {
		convo.stop();
		convo.next();
		return;
	}

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
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.say(`This looks great. Let's add these to your existing list now`);
				askToPrioritizeList(response, convo);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
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

	// get tasks from array
	var userInput = response.text; // i.e. `1, 3, 4, 2`
	var prioritizedTaskArray = prioritizeTaskArrayFromUserInput(allTasksArray, userInput)

	// means user input is invalid
	if (!prioritizedTaskArray) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		askToPrioritizeList(response, convo);
		return;
	}

	var taskListMessage = convertArrayToTaskListMessage(prioritizedTaskArray);

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [
		{
			pattern: utterances.yes,
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
						where: [`"live" = ?`, true ]
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
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Whoops :banana: Let's try to do this again");
				askToPrioritizeList(response, convo);
				convo.next();
			}
		}
	]);


}



