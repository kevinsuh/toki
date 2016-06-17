import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

export const FINISH_WORD = 'done';
export const EXIT_EARLY_WORDS = ['exit', 'stop','never mind','quit'];

// base controller for start day
export default function(controller) {

	// programmatic trigger of actual day start flow: `begin_day_flow`
	controller.on('trigger_day_start', (bot, config) => {

		const { SlackUserId } = config;
		controller.trigger(`user_confirm_new_day`, [ bot, { SlackUserId } ]);

	})

	/**
	 * 		User directly asks to start day
	 * 				~* via Wit *~
	 * 			confirm for `begin_day_flow`
	 */
	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{
			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
				var name = user.nickName || user.email;
				convo.say(`Hey, ${name}!`);
				convo.on('end', (convo) => {
					controller.trigger(`user_confirm_new_day`, { SlackUserId });
				})
			});
		}, 1000);
	});

	/**
	 * 			User confirms he is wanting to
	 * 					start his day. confirmation
	 * 				needed every time b/c this resets everything
	 */

	controller.on('user_confirm_new_day', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name              = user.nickName || user.email;
				convo.name            = name;
				convo.readyToStartDay = false;

				convo.ask(`Would you like to start your day?`, [
					{
						pattern: bot.utterances.yes,
						callback: (response, convo) => {
							convo.say("Let's do it! :car: :dash:");
							convo.readyToStartDay = true;
							convo.next();
						}
					},
					{
						pattern: bot.utterances.no,
						callback: (response, convo) => {
							convo.say("Okay. Let me know whenever you're ready to start your day :wave:");
							convo.next();
						}
					},
					{
						default: true,
						callback: (response, convo) => {
							convo.say("Couldn't quite catch that. Let me know whenever you're ready to `start your day` :wave:");
							convo.next();
						}
					}
				]);
				convo.on('end', (convo) => {
					if (convo.readyToStartDay) {
						controller.trigger(`begin_day_flow`, [ bot, { SlackUserId }]);
					}
				});
			
			});
		});

	})

	/**
	* 	~ ACTUAL START OF YOUR DAY ~
	* 		* ask for today's tasks
	* 		* prioritize tasks
	* 		* set time to tasks
	* 		* enter work session flow
	* 		
	*/
	controller.on('begin_day_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name   = user.nickName || user.email;
				convo.name = name;

				convo.dayStart = {
					UserId: user.id,
					startDayDecision: false // what does user want to do with day
				}

				// start the flow
    		askForDayTasks(err, convo);

    		// on finish conversation
    		convo.on('end', (convo) => {

  				var responses = convo.extractResponses();
  				const { dayStart } = convo;

  				console.log('done!')
  				console.log("here is day start object:\n\n\n");
  				console.log(convo.dayStart);
  				console.log("\n\n\n");

    			if (convo.status == 'completed') {

    				const { UserId, prioritizedTaskArray } = dayStart;

    				// log `start_work` in SessionGroups
    				// and all other relevant DB inserts
    				models.SessionGroup.create({
    					type: "start_work",
    					UserId
    				})
    				.then((sessionGroup) => {

    					// make all pending tasks => archived, then all live tasks => pending
	    				// BEFORE the newly created start SessionGroup
	    				user.getDailyTasks({
	    					where: [`"DailyTask"."createdAt" < ? AND "DailyTask"."type" = ?`, sessionGroup.createdAt, "pending"]
	    				})
	    				.then((dailyTasks) => {
	    					dailyTasks.forEach((dailyTask) => {
					        dailyTask.update({
					          type: "archived"
					        });
					      });
					      user.getDailyTasks({
		    					where: [`"DailyTask"."createdAt" < ? AND "DailyTask"."type" = ?`, sessionGroup.createdAt, "live"]
		    				})
		    				.then((dailyTasks) => {

		    					dailyTasks.forEach((dailyTask) => {
						        dailyTask.update({
						          type: "pending"
						        });
						      });

						      // After all of the previous tasks have been put into "pending", choose the select ones and bring them back to "live"
			    				prioritizedTaskArray.forEach((task, index) => {
			    					const { text, minutes} = task;
			    					var priority = index + 1;
			    					models.Task.create({
									    text
									  })
									  .then((task) => {
									    models.DailyTask.create({
									      TaskId: task.id,
									      priority,
									      minutes,
									      UserId
									    });
									    // THIS IS WHERE YOU WILL UPDATE THE PREVIOUS DAY'S PENDING TASKS
									  });
			    				});

		    				});
	    				});

	    			});

    				// TRIGGER SESSION_START HERE
    				if (dayStart.startDayDecision == intentConfig.START_SESSION) {
    					controller.trigger(`confirm_new_session`, [ bot, { SlackUserId }]);
    					return;
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

		})

	});

};

// user just started conersation and is entering tasks
function askForDayTasks(response, convo){

	const { task }                = convo;
	const { bot, source_message } = task;

	console.log("in ask for day tasks");;
	console.log(convo.name);

	convo.say(`What tasks would you like to work on today? :pencil: You can enter everything in one line separated by commas, or send me each task in a separate line`);
	convo.ask(`Then just tell me when you're done by saying \`${FINISH_WORD}\``, (response, convo) => {

		for (var i = 0; i < EXIT_EARLY_WORDS.length; i++) {
			console.log(`in exit early words loop! ${EXIT_EARLY_WORDS[i]}`);
			if (response.text == EXIT_EARLY_WORDS[i])
				convo.stop();
		}

		console.log(`response is`);
		console.log(response);
		if (response.text == FINISH_WORD) {
			convo.say("Awesome! You can always add more tasks later by telling me, `I'd like to add a task` or something along those lines :grinning:");
			displayTaskList(response, convo);
			convo.next();
		}
	}, { 'key' : 'tasks', 'multiple': true});

}

// user has just entered his tasks for us to display back
function displayTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	var { tasks } = convo.responses;

	var tasks = convo.responses.tasks;
	var taskArray = convertResponseObjectsToTaskArray(tasks);

	// taskArray is now attached to convo
	convo.dayStart.taskArray = taskArray;

	console.log("TASKS:")
	console.log(taskArray);

	var taskListMessage = convertArrayToTaskListMessage(taskArray);

	// we need to prioritize the task list here to display to user
	convo.say(`Now, please rank your tasks in order of your priorities today`);
	convo.say(taskListMessage);
	convo.ask(`You can just list the numbers, like \`3, 4, 1, 2, 5\``, (response, convo) => {
		prioritizeTaskList(response, convo);
		convo.next();
	}, { 'key' : 'taskPriorities' });
	
}

// user has listed `5, 4, 2, 1, 3` for priorities to handle here
function prioritizeTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	// organize the task list!
	var { taskArray } = convo.dayStart;

	// get user priority order (`1,4,3,2`), convert it to an array of ints, and use that to prioritize your array
	var initialPriorityOrder = response.text;
	
	// either a non-number, or number > length of tasks
	var isInvalid = false;
	var nonNumberTest = new RegExp(/\D/);
	initialPriorityOrder = initialPriorityOrder.split(",").map((order) => {
		order = order.trim();
		var orderNumber = parseInt(order);
		if (nonNumberTest.test(order) || orderNumber > taskArray.length)
			isInvalid = true;
		return orderNumber;
	});

	if (isInvalid) {
		convo.say("Oops, looks like you didn't put in valid numbers :thinking_face:. Let's try this again");
		displayTaskList(response, convo);
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
		prioritizedTaskArray.push(taskArray[order]);
	})

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;

	var taskListMessage = convertArrayToTaskListMessage(prioritizedTaskArray);

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.say("Excellent! Last thing: how much time would you like to allocate to each task today?");
				convo.say(taskListMessage);
				getTimeToTasks(response, convo);
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {

				convo.say("Whoops :banana: Let's try to do this again");
				displayTaskList(response, convo);
				convo.next();

			}
		}
	], { 'key' : 'confirmedRightPriority' });

}

// ask the question to get time to tasks
function getTimeToTasks(response, convo) {
	convo.ask(`Just say, \`30, 40, 1 hour, 1hr 10 min, 15m\` in order and I'll figure it out and assign those times to the tasks above :smiley:`, (response, convo) => {
		assignTimeToTasks(response, convo);
		convo.next();
	}, { 'key' : 'timeToTasksResponse' });
}

// this is the work we do to actually assign time to tasks
function assignTimeToTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	var { prioritizedTaskArray }  = convo.dayStart;

	var timeToTask = response.text;

	// need to check for invalid responses.
	// does not say minutes or hours, or is not right length
	var isInvalid = false;
	timeToTask = timeToTask.split(",");
	if (timeToTask.length != prioritizedTaskArray.length) {
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

	prioritizedTaskArray = prioritizedTaskArray.map((task, index) => {
		return {
			...task,
			minutes: timeToTask[index]
		}
	});

	convo.dayStart.prioritizedTaskArray = prioritizedTaskArray;
	var taskListMessage = convertArrayToTaskListMessage(prioritizedTaskArray);

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
				convo.say("Boom! This looks great");
				convo.ask("Ready to start your first focused work session today?", [
						{
							pattern: bot.utterances.yes,
							callback: (response, convo) => {
								convo.dayStart.startDayDecision = intentConfig.START_SESSION;
								convo.next();
							}
						},
						{
							pattern: bot.utterances.no,
							callback: (response, convo) => {
								convo.say("Great! Let me know when you're ready to start");
								convo.say("Alternatively, you can ask me to `remind` you to start at a specific time, like `remind me to start at 10am` or a relative time like `remind me in 10 minutes`");
								convo.next();
							}
						}
					], { 'key' : 'startFirstSession' })
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say("Let's give this another try :repeat_one:");
				convo.say("Send me the amount of time you'd like to work on each task above, separated by commas. The first time you list will represent the first task above, the second time you list will represent the second task, and on and on");
				convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `2 hours`");
				convo.ask(taskListMessage, (response, convo) => {
					assignTimeToTasks(response, convo);
					convo.next();
				})
				convo.next();
			}
		}
	]);

}

