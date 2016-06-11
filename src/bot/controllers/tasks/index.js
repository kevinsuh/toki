import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';

const FINISH_WORD = 'done';

// base controller for tasks
export default function(controller) {

	/**
	 * 		INDEX functions of tasks
	 */
	
	/**
	* 	START OF YOUR DAY
	*/

	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		// find user then reply
		models.SlackUser.find({
			where: { SlackUserId },
			include: [
				models.User
			]
		})
		.then((slackUser) => {
			
			bot.send({
        type: "typing",
        channel: message.channel
	    });
	    setTimeout(()=>{
	    	bot.startConversation(message, (err, convo) => {
	    		var name = slackUser.User.nickName || slackUser.User.email;

	    		// configure necessary properties on convo object
	    		convo.name = name;

	    		// start the flow
	    		askForDayTasks(err, convo);

	    		convo.on('end', (convo) => {
	    			if (convo.status == 'completed') {
	    				bot.reply(message,"thx for finishing");
	    				var responses = convo.extractResponses();
	    				console.log('done!')
	    				console.log(responses);
	    			} else {
	    				// if convo gets ended prematurely
	    				bot.reply(message, "Okay then, never mind!");
	    			}
	    		});

	    	});
	    }, randomInt(1000, 1750));
		});

	});

	/**
	 * 		YOUR DAILY TASKS
	 */

	controller.hears(['daily_tasks'], 'direct_message', wit.hears, (bot, message) => {

		var request = http.get("http://www.heynavi.co/v1/tasks?startDate=2016-05-05&endDate=2016-05-28&selectedUserID=4", (res) => {
			
			res.setEncoding('utf8');
			var reply = `Your tasks:\n`;
			var count = 1;

			var tasksObject = '';
			res.on("data", (chunk) => {
				tasksObject += chunk;
			});
			res.on("end", () => {

				tasksObject = JSON.parse(tasksObject);
				const { tasks } = tasksObject;

				for (let taskObject of tasks) {
					const { task } = taskObject
					reply += `${count}) ${task.content}\n`;
					count += 1;
				}
				
				bot.reply(message, reply);
			});

		}).on('error', (e) => {
			console.log(`Got error: ${e.message}`);
		});

	});

};

function askForDayTasks(response, convo){

	const { task }                = convo;
	const { bot, source_message } = task;

	console.log("in ask for day tasks");;
	console.log(convo.name);

	convo.say(`Hey ${convo.name}! What tasks would you like to work on today? :pencil:`);
	convo.say(`You can enter everything in one line separated by commas, or send me each task in a separate line`);
	convo.ask(`Then just tell me when you're done by saying \`${FINISH_WORD}\``, (response, convo) => {
		console.log("response is:");
		console.log(response);
		if (response.text == FINISH_WORD) {
			convo.say("You can always add more tasks later by telling me, `I'd like to add a task` or something along those lines :grinning:");
			displayTaskList(response, convo);
			convo.next();
		}
	}, { 'key' : 'tasks', 'multiple': true});

}

function displayTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	var { tasks } = convo.responses;

	var tasks = convo.responses.tasks;
	var taskStringArray = convertResponseObjectsToTaskListArray(tasks);

	// taskArray is now attached to convo
	convo.taskStringArray = taskStringArray;

	console.log("TASKS:")
	console.log(taskStringArray);

	var taskListMessage = '';
	var count = 1;
	taskStringArray.forEach((task) => {
		taskListMessage += `> ${count}) ${task}\n`;
		count++;
	});

	// we need to prioritize the task list here to display to user
	convo.say(`Awesome! Now, please rank your tasks in order of your priorities today`);
	convo.say(taskListMessage);
	convo.ask(`You can just list the numbers, like \`3, 4, 1, 2, 5\``, (response, convo) => {
		prioritizeTaskList(response, convo);
		convo.next();
	});
	
}

function prioritizeTaskList(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	// organize the task list!
	var { taskStringArray } = convo;
	console.log("TASK STRING ARRAY!");
	console.log(taskStringArray);

	console.log("USER RESPONSE TO PRIORITY!");
	console.log(response);

	var initialPriorityOrder = response.text;
	initialPriorityOrder = initialPriorityOrder.split(",").map((order) => { return parseInt(order) });

	var priorityOrder = [];
	initialPriorityOrder.forEach(function(order) {
		if ( order > 0) {
			order--; // make it 0-index based
			priorityOrder.push(order);
		}
	});

	var prioritizedTaskStringArray = [];
	priorityOrder.forEach((order) => {
		prioritizedTaskStringArray.push(taskStringArray[order]);
	})

	convo.prioritizedTaskStringArray = prioritizedTaskStringArray;

	var taskListMessage = '';
	var count = 1;
	prioritizedTaskStringArray.forEach((task) => {
		taskListMessage += `> ${count}) ${task}\n`;
		count++;
	});

	convo.say("Is this the right priority?");
	convo.ask(taskListMessage, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.say("LETS GO!! PRIORITIZED TASKS!!");
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say("dammit.... ok");
				convo.next();
			}
		}
	]);

}


/**
 * takes array of tasks and converts to array of task STRINGS
 * @param  {[object]} tasks task OBJECTS
 * @return {[string]}       task STRINGS
 */
function convertResponseObjectsToTaskListArray(tasks) {

	var taskString = '';
	tasks.forEach((task, index) => {
		// ignore the last one (`done` command)
		if (task.text == FINISH_WORD)
			return;

		taskString += task.text;
		taskString += '\n';
	});

	console.log(`TASK STRING: ${taskString}`);

	const commaOrNewLine = /[,\n]+/;
	var tasksArray = taskString.split(commaOrNewLine);
	tasksArray.pop(); // last one will be \n with this reg ex split

	return tasksArray.map((task) => {
		return task.trim();
	});
}
