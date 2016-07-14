import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';
import { FINISH_WORD, EXIT_EARLY_WORDS, NONE } from '../../lib/constants';

import { showPendingTasks, askForDayTasks } from '../modules/plan';

import { resumeQueuedReachouts } from '../index';

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
	 */
	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{
			models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {
				controller.trigger(`user_confirm_new_day`, [ bot, { SlackUserId }]);

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
					convo.config = { SlackUserId };
					var name = user.nickName || user.email;
					convo.say(`Hey, ${name}!`);
					convo.on('end', (convo) => {
						console.log(convo);
						const { SlackUserId } = convo.config;

					})
				});
			})
		}, 1000);
	});

	/**
	 * 			User confirms he is wanting to
	 * 					start his day. confirmation
	 * 				needed EVERY time b/c this resets everything
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

			user.getSessionGroups({
				limit: 5,
				where: [ `"SessionGroup"."type" = ?`, "start_work"]
			})
			.then((sessionGroups) => {

				var useHelperText = false;
				if (sessionGroups.length == 0) {
					// if user has 0 start days, then we will trigger helper text flow
					useHelperText = true;
				}

				// testing for now
				// useHelperText = true;

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					var name              = user.nickName || user.email;
					convo.name            = name;
					convo.readyToStartDay = false;

					convo.ask(`Would you like to start your day?`, [
						{
							pattern: utterances.yes,
							callback: (response, convo) => {
								convo.say("Let's do it! :car: :dash:");
								convo.readyToStartDay = true;
								convo.next();
							}
						},
						{
							pattern: utterances.no,
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
							controller.trigger(`begin_day_flow`, [ bot, { SlackUserId, useHelperText }]);
						} else {
							resumeQueuedReachouts(bot, { SlackUserId });
						}
					});
				
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

		const { SlackUserId, useHelperText } = config;

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
					bot,
					UserId: user.id,
					useHelperText,
					startDayDecision: false, // what does user want to do with day
					prioritizedTaskArray: [] // the final tasks to do for the day
				}

				// live or pending tasks, that are not completed yet
				user.getDailyTasks({
					where: [`"DailyTask"."type" in (?) AND "Task"."done" = ?`, ["pending", "live"], false ],
					include: [ models.Task ]
				})
				.then((dailyTasks) => {

					if (dailyTasks.length == 0) {
						// no pending tasks -- it's a new day
						askForDayTasks(err, convo);
					} else {
						// has pending tasks
						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
						convo.dayStart.pendingTasks = dailyTasks;
						showPendingTasks(err, convo);
					}

				});

				// on finish conversation
				convo.on('end', (convo) => {

					var responses = convo.extractResponses();
					const { dayStart } = convo;

					console.log('done!')
					console.log("here is day start object:\n\n\n");
					console.log(convo.dayStart);
					console.log("\n\n\n");

					if (convo.status == 'completed') {

						const { UserId, taskArray } = dayStart;

						// log `start_work` in SessionGroups
						// and all other relevant DB inserts
						models.SessionGroup.create({
							type: "start_work",
							UserId
						})
						.then((sessionGroup) => {

							// make all tasks into archived at end of `start_day` flow
							// because you explicitly decided to not work on them anymore
							user.getDailyTasks({
								where: [`"DailyTask"."createdAt" < ? AND "DailyTask"."type" IN (?)`, sessionGroup.createdAt, ["pending", "live"] ]
							})
							.then((dailyTasks) => {
								dailyTasks.forEach((dailyTask) => {
									dailyTask.update({
										type: "archived"
									});
								});
								
								// After all of the previous tasks have been put into "pending", choose the select ones and bring them back to "live"
								taskArray.forEach((task, index) => {

									const { dataValues } = task;
									var priority = index + 1;
									const { text, minutes} = task;

									if (dataValues) { // only existing tasks have data values

										// for these, we'll still be making NEW `daily_tasks`, using OLD `tasks`
										const { id } = dataValues;
										models.DailyTask.find({
											where: { id },
											include: [ models.Task ]
										})
										.then((dailyTask) => {
											const TaskId = dailyTask.TaskId;
											models.DailyTask.create({
												TaskId,
												minutes,
												priority,
												UserId
											});
										});

									} else { // new task
										
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
										});
									}

								});
							});

							// cancel all user breaks cause user is RDY TO START DAY
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

						});

						// TRIGGER SESSION_START HERE
						if (dayStart.startDayDecision == intentConfig.START_SESSION) {
							controller.trigger(`confirm_new_session`, [ bot, { SlackUserId }]);
							return;
						}

						resumeQueuedReachouts(bot, { SlackUserId });

					} else {
						// default premature end
						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
							resumeQueuedReachouts(bot, { SlackUserId });
							convo.say("Okay! Exiting now. Let me know when you want to start your day!");
							convo.next();
						});
					}
				});

			});

		})

	});

};

