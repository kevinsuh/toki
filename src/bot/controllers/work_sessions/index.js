import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';
import moment from 'moment-timezone';

import endWorkSessionController from './endWorkSession';
import middleWorkSessionController from './middleWorkSession';
import startWorKSessionController from './startWorKSession';

import intentConfig from '../../lib/intents';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

// base controller for work sessions
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startWorKSessionController(controller);
	middleWorkSessionController(controller);
	endWorkSessionController(controller);

	/**
	 * 		IS_BACK ("READY TO WORK" - Peon WCIII)
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

				// temporary fix to get tasks
				var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");
				user.getDailyTasks({
					where: [`"DailyTask"."createdAt" > ? AND "Task"."done" = ?`, timeAgoForTasks, false],
					include: [ models.Task ],
					order: `"DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
					var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

					bot.startConversation(message, (err, convo) => {

						convo.isBack = {
							SlackUserId,
							isBackDecision: false // what user wants to do
						}

						var name = user.nickName || user.email;

						convo.say(`Welcome back, ${name}!`);
						if (dailyTasks.length > 0) {
						 convo.say(`Here are your priorities from our last time together:\n${taskListMessage}`);
						}
						var options = ["• start a work session with your most recent priorities", "• set new priorities for today - and we can move any of your most recent priorities into this new list, too!", "• end our day together"];
						var optionsList = "";
						options.forEach((option) => {
							optionsList = `${optionsList}> ${option}\n`;
						})
						convo.ask(`What would you like to do now? I can help you with any of these things:\n${optionsList}`, (response, convo) => {
							// should eventually contain logic for 5 hour start_day vs start_session
							var { intentObject: { entities } } = response;
							var { intent }                     = entities;
							var intentValue                    = (intent && intent[0]) ? intent[0].value : null;

							if (intentValue) {
								switch(intentValue) {
									case intentConfig.START_SESSION:
										convo.isBackDecision = intentConfig.START_SESSION;
										convo.say(`Love it. Let's kick off a new session :soccer:`);
										break;
									case intentConfig.END_DAY:
										convo.isBackDecision = intentConfig.END_DAY;
										convo.say(`It's about that time, isn't it?`);
										break;
									case intentConfig.VIEW_TASKS:
										convo.say(`I agree - a fresh start seems like a great idea. Let's do it! :tangerine:`);
										break;
									default:
										convo.say(`Totally cool, just let me know when you're ready to do either of those things! :wave:`);
										break;
								}
							}
							convo.next();

						});
						convo.on(`end`, (convo) => {
							const { isBackDecision } = convo;
							if (convo.status == 'completed') {
								switch (isBackDecision) {
									case intentConfig.START_SESSION:
										console.log("\n\n\nSTART_SESSION!\n\n\n");
										break;
									case intentConfig.END_DAY:
										console.log("\n\n\nEND_DAY\n\n\n");
										break;
									case intentConfig.VIEW_TASKS:
									console.log("\n\n\nVIEW_TASKS\n\n\n");
										break;
									default:
										break;
								}
							} else {
								bot.reply(message, "Okay! Let me know when you want to start a session or day");
							}
						});
					});

				})

				
			});
		}, 1000);
		

	});

};