import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

// base controller for tasks
export default function(controller) {

	/**
	 * 		INDEX functions of tasks
	 */
	
	/**
	* 	START OF YOUR DAY
	*/

	// we are relying on wit to do all of the NL parsing for us
	// so that it normalizes into `intent` strings for us to decipher
	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {
		bot.reply(message, "Okay let's start the day then!");
	});

	// get my daily tasks
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