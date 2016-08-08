import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertStringToNumbersArray, commaSeparateOutTaskArray } from '../../lib/messageHelpers';
import { getCurrentDaySplit, closeOldRemindersAndSessions } from '../../lib/miscHelpers';
import { constants, dateOfNewPlanDayFlow } from '../../lib/constants';

import { startNewPlanFlow } from '../modules/plan';
import { startEditPlanConversation } from './editPlanFunctions';

/**
 * Starting a new plan for the day
 */

import { resumeQueuedReachouts } from '../index';

// base controller for new plan
export default function(controller) {

	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{
			controller.trigger(`new_plan_flow`, [ bot, { SlackUserId }]);
		}, 1000);

	});

	controller.hears(['daily_tasks', 'add_daily_task', 'completed_task'], 'direct_message', wit.hears, (bot, message) => {

		const { text, channel } = message;
		const SlackUserId       = message.user;

		let config = { SlackUserId, message };

		// wit may pick up "add check in" as add_daily_task
		if (utterances.startsWithAdd.test(text) && utterances.containsCheckin.test(text)) {
			if (utterances.containsOnlyCheckin.test(text)){
				config.reminder_type = "work_session";
			}
			controller.trigger(`ask_for_reminder`, [ bot, config ]);
			return;
		};

		controller.trigger(`plan_command_center`, [ bot, config ]);

	});

	/**
	* 	~ NEW PLAN FOR YOUR DAY ~
	* 	1) get your 3 priorities
	* 	2) make it easy to prioritize in order for the day
	* 	3) enter work sessions for each of them
	*/

	controller.on('new_plan_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;
			const { SlackUser: { tz } } = user;

			let daySplit = getCurrentDaySplit(tz);

			user.getSessionGroups({
				where: [ `"SessionGroup"."type" = ? AND "SessionGroup"."createdAt" > ?`, "start_work", dateOfNewPlanDayFlow],
				limit: 1
			})
			.then((sessionGroups) => {

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					var name   = user.nickName || user.email;
					convo.name = name;

					convo.newPlan = {
						SlackUserId,
						tz,
						daySplit,
						onboardVersion: false,
						prioritizedTasks: [],
						startTask: {
							index: 0, // fail-safe default. should get updated in flow
							minutes: 30 // fail-safe default. should get updated in flow
						},
						startTime: false, // default will be now
						includeSlackUserIds: []
					}

					let day = moment().tz(tz).format('dddd');

					if (sessionGroups.length == 0) {
						convo.newPlan.onboardVersion = true;
					}

					if (!convo.newPlan.onboardVersion) {
						convo.say(`Happy ${day}, ${name}! Let's win the ${daySplit} :muscle:`);
					}

					startNewPlanFlow(convo);

					// on finish conversation
					convo.on('end', (convo) => {

						const { newPlan } = convo;
						let { exitEarly, prioritizedTasks, startTask, startTime, includeSlackUserIds, startNow } = newPlan;

						closeOldRemindersAndSessions(user);

						// save startTask information
						startTask.taskObject = {
							...prioritizedTasks[startTask.index],
							minutes: startTask.minutes
						};
						prioritizedTasks[startTask.index] = startTask.taskObject;

						if (exitEarly) {
							return;
						}

						// create plan
						models.SessionGroup.create({
							type: "start_work",
							UserId
						})
						.then((sessionGroup) => {

							// then, create the 3 priorities for today
							user.getDailyTasks({
								where: [`"DailyTask"."type" = ?`, "live"]
							})
							.then((dailyTasks) => {
								let dailyTaskIds = dailyTasks.map(dailyTask => dailyTask.id);
								if (dailyTaskIds.length == 0) {
									dailyTaskIds = [0]
								};
								models.DailyTask.update({
									type: "archived"
								}, {
									where: [ `"DailyTasks"."id" IN (?)`, dailyTaskIds ]
								})
								.then((dailyTasks) => {
									prioritizedTasks.forEach((task, index) => {
										const priority = index + 1;
										const { text, minutes } = task;
										models.Task.create({
											text
										})
										.then((task) => {
											task.createDailyTask({
												minutes,
												priority,
												UserId
											})
											.then((dailyTask) => {
												const DailyTaskId = dailyTask.id;

												if (index == startTask.index) {
													if (startTime) {
														// if you asked for a queued reminder
														models.Reminder.create({
															UserId,
															remindTime: startTime,
															type: "start_work",
															DailyTaskId
														})
													} else if (startNow) {
														// start now!
														controller.trigger(`begin_session`, [ bot, { SlackUserId } ]);
													}
												}
											})
										})
									});
								});
							});

							// include who you want to include in your list
							if (includeSlackUserIds) {
								includeSlackUserIds.forEach((IncludedSlackUserId) => {
									models.Include.create({
										IncluderSlackUserId: SlackUserId,
										IncludedSlackUserId
									})
								})
							}
						})

						console.log("here is new plan object:\n");
						console.log(convo.newPlan);
						console.log("\n\n\n");

						setTimeout(() => {
							resumeQueuedReachouts(bot, { SlackUserId });
						}, 1250);

						// placeholder for keep going
						if (newPlan) {

						} else {
							// default premature end
							bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
								resumeQueuedReachouts(bot, { SlackUserId });
								convo.say("Okay! Let me know when you want to plan for today");
								convo.next();
							});
						}

					});

				});
			})

				

		})

	});

	/**
	 * 	~ PLAN COMMAND CENTER ~
	 * 	You enter this plan command center
	 * 	Can have preset options that will handle the plan accordingly:
	 * 		1) "do" a task
	 * 		2) "add" tasks
	 * 		3) "complete" tasks
	 * 		4) "delete" tasks
	 */
	
	controller.on(`plan_command_center`, (bot, config) => {

		console.log("\n\n\n ~~ In Plan Command Center ~~ \n\n\n");

		const { message, SlackUserId, botCallback, planDecision } = config;

		let text    = message ? message.text : '';
		let channel = message ? message.channel : false;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			let botToken = bot.config.token;
			bot          = bots[botToken];
		}

		let taskNumbers = convertStringToNumbersArray(text);
		if (taskNumbers) {
			config.taskNumbers = taskNumbers;
		}

		// if not triggered with a pre-defined planDecision,
		// parse text to try and figure it out
		if (!planDecision) {
			// this is how you make switch/case statements with RegEx
			switch (text) {
				case (text.match(constants.PLAN_DECISION.complete.reg_exp) || {}).input:
					// complete task
					config.planDecision = constants.PLAN_DECISION.complete.word;
					break;
				case (text.match(constants.PLAN_DECISION.add.reg_exp) || {}).input:
					// add task
					config.planDecision = constants.PLAN_DECISION.add.word;
					break;
				case (text.match(constants.PLAN_DECISION.view.reg_exp) || {}).input:
					// view plan
					config.planDecision = constants.PLAN_DECISION.view.word;
					break;
				case (text.match(constants.PLAN_DECISION.delete.reg_exp) || {}).input:
					// delete plans
					config.planDecision = constants.PLAN_DECISION.delete.word;
					break;
				case (text.match(constants.PLAN_DECISION.edit.reg_exp) || {}).input:
					// edit plan
					config.planDecision = constants.PLAN_DECISION.edit.word;
					break;
				case (text.match(constants.PLAN_DECISION.work.reg_exp) || {}).input:
					// do plan
					config.planDecision = constants.PLAN_DECISION.work.word;
					break;
				default:
					config.planDecision = config.taskNumbers ? constants.PLAN_DECISION.work.word : constants.PLAN_DECISION.view.word;
					break;
			}
		}

		if (channel) {
			bot.send({
				type: "typing",
				channel: channel
			});
		}
		setTimeout(() => {
			controller.trigger(`edit_plan_flow`, [ bot, config ]);
		}, 500);

	});

	/**
	 * 		WHERE YOU ACTUALLY CARRY OUT THE ACTION FOR THE PLAN
	 */
	controller.on(`edit_plan_flow`, (bot, config) => {

		const { SlackUserId, taskNumbers, planDecision, message, botCallback } = config;

		if (botCallback) {
			// if botCallback, need to get the correct bot
			let botToken = bot.config.token;
			bot          = bots[botToken];
		}

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;
			const { SlackUser: { tz } } = user;

			user.getWorkSessions({
				where: [`"open" = ?`, true]
			})
			.then((workSessions) => {

				let openWorkSession = false;
				if (workSessions.length > 0) {
					openWorkSession = workSessions[0];
				}

				user.getDailyTasks({
					where: [`"DailyTask"."type" = ?`, "live"],
					include: [ models.Task ],
					order: `"Task"."done", "DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

						convo.planEdit = {
							bot,
							tz,
							SlackUserId,
							dailyTasks,
							updateTaskListMessageObject: {},
							newTasks: [],
							dailyTaskIdsToDelete: [],
							dailyTaskIdsToComplete: [],
							dailyTasksToUpdate: [], // existing dailyTasks
							openWorkSession,
							planDecision,
							taskNumbers,
							changePlanCommand: {
								decision: false
							},
							currentSession: false
						}

						// if you are changing between commands, we will
						// store that information and have special config ability
						if (config.changePlanCommand && config.changePlanCommand.decision) {
							convo.planEdit.changedPlanCommands = true;
						}

						// this is the flow you expect for editing tasks
						startEditPlanConversation(convo);

						
						convo.on('end', (convo) => {
							
							var { newTasks, dailyTasks, SlackUserId, dailyTaskIdsToDelete, dailyTaskIdsToComplete, dailyTasksToUpdate, startSession, dailyTasksToWorkOn, changePlanCommand, currentSession } = convo.planEdit;

							console.log("\n\n\n at end of convo planEdit")
							console.log(convo.planEdit);

							// this means we are changing the plan!
							if (changePlanCommand.decision) {
								let message = { text: changePlanCommand.text };
								let config = { SlackUserId, message, changePlanCommand }
								controller.trigger(`plan_command_center`, [ bot, config ]);
								return;
							}

							resumeQueuedReachouts(bot, { SlackUserId });

							if (startSession && dailyTasksToWorkOn && dailyTasksToWorkOn.length > 0) {

								let config = {
									SlackUserId,
									dailyTaskToWorkOn: dailyTasksToWorkOn[0],
									currentSession
								}
								let bot = convo.planEdit.bot;
								controller.trigger(`begin_session`, [ bot, config ]);
								return;

							}

							/*
							// add new tasks if they got added
							if (newTasks.length > 0) {
								var priority = dailyTasks.length;
								// add the priorities
								newTasks = newTasks.map((newTask) => {
									priority++;
									return {
										...newTask,
										priority
									};
								});

								newTasks.forEach((newTask) => {
									const { minutes, text, priority } = newTask;
									if (minutes && text) {
										models.Task.create({
											text
										})
										.then((task) => {
											const TaskId = task.id;
											models.DailyTask.create({
												TaskId,
												priority,
												minutes,
												UserId
											});
										});
									}
								})
							}
							*/

							// delete tasks if requested
							if (dailyTaskIdsToDelete.length > 0) {
								models.DailyTask.update({
									type: "deleted"
								}, {
									where: [`"DailyTasks"."id" in (?)`, dailyTaskIdsToDelete]
								})
							}

							// complete tasks if requested
							if (dailyTaskIdsToComplete.length > 0) {
								models.DailyTask.findAll({
									where: [`"DailyTask"."id" in (?)`, dailyTaskIdsToComplete],
									include: [models.Task]
								})
								.then((dailyTasks) => {

									var completedTaskIds = dailyTasks.map((dailyTask) => {
										return dailyTask.TaskId;
									});

									models.Task.update({
										done: true
									}, {
										where: [`"Tasks"."id" in (?)`, completedTaskIds]
									})
								})
							}

							/*

							// update daily tasks if requested
							if (dailyTasksToUpdate.length > 0) {
								dailyTasksToUpdate.forEach((dailyTask) => {
									if (dailyTask.dataValues && dailyTask.minutes && dailyTask.text) {
										const { minutes, text } = dailyTask;
										models.DailyTask.update({
											text,
											minutes
										}, {
											where: [`"DailyTasks"."id" = ?`, dailyTask.dataValues.id]
										})
									}
								})
							}

							setTimeout(() => {

								setTimeout(() => {
									prioritizeDailyTasks(user);
								}, 1000);

								// only check for live tasks if SOME action took place
								if (newTasks.length > 0 || dailyTaskIdsToDelete.length > 0 || dailyTaskIdsToComplete.length > 0 || dailyTasksToUpdate.length > 0) {
									checkWorkSessionForLiveTasks({ SlackUserId, bot, controller });
								}
							}, 750);
							*/
	
						});
					});
				});
			})
		})
	});
	

	/**
	 * 		ENDING YOUR PLAN
	 */
	controller.on(`end_plan_flow`, (bot, config) => {
		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// get the most recent start_work session group to measure
			// a day's worth of work
			user.getSessionGroups({
				order: `"SessionGroup"."createdAt" DESC`,
				where: [`"SessionGroup"."type" = ?`, "start_work"],
				limit: 1
			})
			.then((sessionGroups) => {
				
				const startSessionGroup   = sessionGroups[0]; // the start day

				user.getDailyTasks({
					where: [`"DailyTask"."createdAt" > ? AND "DailyTask"."type" = ?`, startSessionGroup.dataValues.createdAt, "live"],
					include: [ models.Task ],
					order: `"DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						convo.say("Okay! Let's end our day!");
						convo.next();

						convo.on('end', (convo) => {
							resumeQueuedReachouts(bot, { SlackUserId });
						});
						
					});

				});

			});

		});
	})

}
