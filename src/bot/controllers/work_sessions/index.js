import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';
import moment from 'moment-timezone';

import endWorkSessionController from './endWorkSession';
import middleWorkSessionController from './middleWorkSession';
import startWorKSessionController from './startWorkSession';

import intentConfig from '../../lib/intents';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

// base controller for work sessions!
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
					where: [`"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?`, timeAgoForTasks, false, "live"],
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
						var options = ["• start a work session with your most recent priorities", "• view your tasks", "• add task(s)", "• end our day together"];
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
										break;
									case intentConfig.END_DAY:
										convo.isBackDecision = intentConfig.END_DAY;
										convo.say(`It's about that time, isn't it?`);
										break;
									case intentConfig.VIEW_TASKS:
										convo.isBackDecision = intentConfig.VIEW_TASKS;
										convo.say(`That sounds great. Let's decide what to do today! :tangerine:`);
										break;
									case intentConfig.ADD_TASK:
										convo.isBackDecision = intentConfig.ADD_TASK;
										convo.say(`Awesome. Let's add some tasks :muscle:`);
										break;
									default:
										convo.say(`Totally cool, just let me know when you're ready to do either of those things! :wave:`);
										break;
								}
							}
							convo.next();

						});
						convo.on(`end`, (convo) => {

							// cancel all `break` and `work_session` type reminders
							user.getReminders({
								where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break"] ]
							}).
							then((reminders) => {
								reminders.forEach((reminder) => {
									reminder.update({
										"open": false
									})
								});
							})

							const { isBackDecision } = convo;
							var config = { SlackUserId };
							if (convo.status == 'completed') {
								switch (isBackDecision) {
									case intentConfig.START_SESSION:
										config.intent = intentConfig.START_SESSION;
										controller.trigger(`new_session_group_decision`, [ bot, config ]);
										break;
									case intentConfig.END_DAY:
										config.intent = intentConfig.END_DAY;
										controller.trigger(`new_session_group_decision`, [ bot, config ]);
										break;
									case intentConfig.VIEW_TASKS:
										config.intent = intentConfig.VIEW_TASKS;
										controller.trigger(`new_session_group_decision`, [ bot, config ]);
										break;
									case intentConfig.ADD_TASK:
										config.intent = intentConfig.ADD_TASK;
										controller.trigger(`new_session_group_decision`, [ bot, config ]);
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