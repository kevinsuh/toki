import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

import addTaskController from './add';

const FINISH_WORD = 'done';

// base controller for tasks
export default function(controller) {

	addTaskController(controller);

	/**
	 * 		YOUR DAILY TASKS
	 */

	controller.hears(['daily_tasks'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;
		var channel       = message.channel;

		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
			// find user then get tasks
			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {

				// temporary fix to get tasks
				var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");

				user.getDailyTasks({
					where: [`"DailyTask"."createdAt" > ?`, timeAgoForTasks],
					include: [ models.Task ],
					order: `"DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

					var taskListMessage = convertArrayToTaskListMessage(dailyTasks);
					bot.reply(message, "Got 'em! Here are your incomplete tasks for today:");
					bot.send({
			        type: "typing",
			        channel
			    });
			    setTimeout(()=>{
			    	bot.reply(message, taskListMessage);
			    }, randomInt(1500, 2000));

				});

			})

		}, 1000);

	});

};