import { bots, wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertStringToNumbersArray, commaSeparateOutTaskArray, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { getCurrentDaySplit, closeOldRemindersAndSessions, prioritizeDailyTasks } from '../../lib/miscHelpers';
import { colorsHash, buttonValues, constants, dateOfNewPlanDayFlow, intentConfig } from '../../lib/constants';

import { startNewPlanFlow } from '../modules/plan';
import { startEditPlanConversation, endOfPlanMessage } from './editPlanFunctions';
import { startEndPlanConversation } from './endPlanFunctions';

/**
 * Starting a new plan for the day
 */

import { resumeQueuedReachouts } from '../index';

// base controller for new plan
export default function(controller) {

	// WIT FOR `new_plan_flow`
	controller.hears(['start_day'], 'direct_message', wit.hears, (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{
			controller.trigger(`new_plan_flow`, [ bot, { SlackUserId }]);
		}, 1000);

	});

	// WIT FOR `end_plan_flow`
	controller.hears(['end_day'], 'direct_message', wit.hears, (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{

			controller.trigger(`confirm_end_plan`, [ bot, { SlackUserId }]);

		}, 500);

	});

	/**
	 * 	EDIT PLAN FLOW
	 */
	controller.hears(['daily_tasks', 'add_daily_task', 'completed_task'], 'direct_message', wit.hears, (bot, message) => {

		const { text, channel } = message;
		const SlackUserId       = message.user;

		let botToken = bot.config.token;
		bot          = bots[botToken];

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
			const { onboarded, includeOthersDecision, SlackUser: { tz } } = user;

			let daySplit = getCurrentDaySplit(tz);

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name   = user.nickName || user.email;
				convo.name = name;

				convo.newPlan = {
					SlackUserId,
					includeOthersDecision,
					tz,
					daySplit,
					onboardVersion: false,
					prioritizedTasks: [],
					startTime: false, // default will be now
					includeSlackUserIds: [],
					pingTeamMembers: false // actual decision to ping
				}

				let day = moment().tz(tz).format('dddd');

				if (!onboarded) {
					convo.newPlan.onboardVersion = true;
				}

				if (!convo.newPlan.onboardVersion) {
					convo.say(`Let's win this ${day}, ${name}! :muscle:`);
				}

				startNewPlanFlow(convo);

				// on finish conversation
				convo.on('end', (convo) => {

					const { newPlan } = convo;
					let { exitEarly, prioritizedTasks, startTime, includeSlackUserIds, startNow, includeOthersDecision, pingTeamMembers } = newPlan;

					closeOldRemindersAndSessions(user);

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

											// this makes sure that this gets triggered only once!
											if (priority == prioritizedTasks.length) {

												if (startTime) {
													// if you asked for a queued reminder
													models.Reminder.create({
														UserId,
														remindTime: startTime,
														type: "start_work"
													});
												} else if (startNow) {
													// start now!
													controller.trigger(`begin_session`, [ bot, { SlackUserId } ]);
												}

												// INCLUDE OTHERS FUNCTIONALITY
												models.User.update({
													includeOthersDecision
												}, {
													where: [ `"Users"."id" = ?`, UserId ]
												})
												.then((user) => {

													if (includeOthersDecision == "YES_FOREVER") {
														pingTeamMembers = true;
													} else if (includeOthersDecision == "NO_FOREVER") {
														pingTeamMembers = false;
													}

													// this is to create for future includes
													if (includeSlackUserIds && includeSlackUserIds.length > 0) {

														models.SlackUser.find({
															where: [`"SlackUserId" = ?`, SlackUserId]
														})
														.then((slackUser) => {

															slackUser.getIncluded({
																include: [ models.User ]
															})
															.then((includedSlackUsers) => {
																
																// only add in NEW slackUserIds to DB
																let alreadyIncludedSlackUserIds = includedSlackUsers.map(slackUser => slackUser.SlackUserId);
																includeSlackUserIds.forEach((IncludedSlackUserId) => {
																	if (alreadyIncludedSlackUserIds.indexOf(IncludedSlackUserId) == -1) {
																		models.Include.create({
																			IncluderSlackUserId: SlackUserId,
																			IncludedSlackUserId
																		});
																	}
																});

																// ping if desired
																if (pingTeamMembers) {
																	includeSlackUserIds.forEach((includeSlackUserId) => {

																		const config = {
																			IncluderSlackUserId: SlackUserId,
																			IncludedSlackUserId: includeSlackUserId
																		};
																		controller.trigger(`notify_team_member`, [ bot, config ]);

																	});
																}

															});

														});

													}

												});

											}
										})
									})

								});

							});
						});

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
				case (text.match(constants.PLAN_DECISION.revise.reg_exp) || {}).input:
					// do plan
					config.planDecision = constants.PLAN_DECISION.revise.word;
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

			user.getSessionGroups({
				order: `"SessionGroup"."createdAt" DESC`,
				limit: 1
			})
			.then((sessionGroups) => {

				let sessionGroup = sessionGroups[0];
				let valid        = true;

				// most recent one should be start_work, since that means you have started a new day
				if (!sessionGroup || sessionGroup.type == "end_work") {
					valid = false;
				}

				if (valid) {
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
									newPriority: false,
									dailyTaskIdsToDelete: [],
									dailyTaskIdsToComplete: [],
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
									
									var { newPriority, dailyTasks, SlackUserId, dailyTaskIdsToDelete, dailyTaskIdsToComplete, startSession, dailyTasksToWorkOn, changePlanCommand, currentSession, showUpdatedPlan } = convo.planEdit;

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

									if (newPriority) {
										const { text, minutes } = newPriority;
										models.Task.create({
											text
										})
										.then((task) => {
											const TaskId = task.id;
											const priority = dailyTasks.length + 1;
											models.DailyTask.create({
												TaskId,
												priority,
												minutes,
												UserId
											})
											.then(() => {
												prioritizeDailyTasks(user);
											})
										})
									}

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

									if (message && message.channel) {
										bot.send({
											type: "typing",
											channel: message.channel
										});
									}

									setTimeout(() => {

										const config = { SlackUserId, bot, controller, showUpdatedPlan };
										endOfPlanMessage(config);
											
									}, 750);
			
								});
							});
						});
					})
				} else {

					// user has not started a day recently
					// automatically trigger new_plan_flow
					// user has not started a day recently
					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						convo.say("You haven't started a day yet!");
						convo.next();

						convo.on('end', (convo) => {
							controller.trigger(`new_plan_flow`, [ bot, { SlackUserId }]);
						});
					});
				}

					
			});


		})
	});
	
	/**
	 * 		CONFIRM TO END YOUR PLAN
	 * 		if you use Wit to end day, or have < 3 priorities
	 * 		it will kick to this confirmation
	 */
	controller.on(`confirm_end_plan`, (bot, config) => {

		const { SlackUserId } = config;

		// give them context and then the ability to end_day early
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;
			const { nickName, SlackUser: { tz } } = user;

			user.getSessionGroups({
				order: `"SessionGroup"."createdAt" DESC`,
				limit: 1
			})
			.then((sessionGroups) => {

				let sessionGroup = sessionGroups[0];
				let valid        = true;

				if (!sessionGroup || sessionGroup.type == "end_work") {
					valid = false;
				}

				if (valid) {

					// sessionGroup exists and it is most recently a start_day (so end_day makes sense here)
					user.getDailyTasks({
						where: [`"DailyTask"."createdAt" > ? AND "DailyTask"."type" = ?`, sessionGroup.dataValues.createdAt, "live"],
						include: [ models.Task ],
						order: `"DailyTask"."priority" ASC`
					})
					.then((dailyTasks) => {

						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

						let completedDailyTasks = [];
						let minutesWorked       = 0;
						dailyTasks.forEach((dailyTask) => {
							if (dailyTask.Task.done) {
								completedDailyTasks.push(dailyTask);
							}
							minutesWorked += dailyTask.dataValues.minutesSpent;
						});

						// if 3 completed tasks, no need to confirm!
						if (completedDailyTasks.length >= 3) {
							controller.trigger(`end_plan_flow`, [ bot, { SlackUserId }]);
							return;
						}

						let timeWorkedString = convertMinutesToHoursString(minutesWorked);

						let options = { reviewVersion: true, noTitles: true };
						let completedTaskListMessage  = convertArrayToTaskListMessage(dailyTasks, options);
						let completedDailyTaskTexts = completedDailyTasks.map((dailyTask) => {
							return dailyTask.dataValues.Task.text;
						})
						let completedTaskString = commaSeparateOutTaskArray(completedDailyTaskTexts, { codeBlock: true });

						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

							convo.endDayDecision = false;
							convo.wonDay         = false;

							convo.say(`Let's wrap up for the day :package:`);

							let message = '';
							if (minutesWorked > 0) {
								message = `You put *${timeWorkedString}* toward your top priorities today`;
								if (completedDailyTasks.length > 0) {
									message = `${message}, completing ${completedTaskString}`;
								}
							}
							if (completedDailyTasks.length > 0) {
								message = `You completed ${completedTaskString}`;
							}

							if (message.length > 0) {
								convo.say(message);
							}
								
							convo.say(`I define winning your day as time well spent, so if you felt your time was well spent at work today, you won the day. If you didn’t, that’s ok - I’m here tomorrow to help you be intentional about what you work on to get you closer to your goals`);
							convo.ask({
								text: `*Did you feel like you won your day today?*`,
								attachments:[
									{
										attachment_type: 'default',
										callback_id: "WIT_END_PLAN",
										fallback: "Did you win your day?",
										color: colorsHash.blue.hex,
										actions: [
											{
													name: buttonValues.yes.name,
													text: "Yes! :punch:",
													value: buttonValues.yes.value,
													type: "button",
													style: "primary"
											},
											{
													name: buttonValues.notToday.name,
													text: "Not today",
													value: buttonValues.notToday.value,
													type: "button"
											},
											{
													name: buttonValues.keepWorking.name,
													text: "Let's keep working!",
													value: buttonValues.keepWorking.value,
													type: "button"
											}
										]
									}
								]
							},[
								{
									pattern: utterances.yes,
									callback: (response, convo) => {
										convo.wonDay         = true;
										convo.endDayDecision = intentConfig.END_DAY;
										convo.next();
									}
								},
								{
									pattern: utterances.no,
									callback: (response, convo) => {
										convo.wonDay         = false;
										convo.endDayDecision = intentConfig.END_DAY;
										convo.next();
									}
								},
								{
									pattern: utterances.containsKeep,
									callback: (response, convo) => {
										convo.say(`Woo hoo! Let's do it`);
										convo.endDayDecision = intentConfig.KEEP_WORKING;
										convo.next();
									}
								},
								{
									default: true,
									callback: (response, convo) => {
										convo.say(`I didn't get that`);
										convo.repeat();
										convo.next();
									}
								}
							]);

							convo.next();

							convo.on('end', (convo) => {
								const { endDayDecision, wonDay } = convo;;
								const config = { SlackUserId, wonDay };
								if (endDayDecision == intentConfig.KEEP_WORKING) {
									controller.trigger(`plan_command_center`, [ bot, config ]);
								} else if (endDayDecision == intentConfig.END_DAY) {
									controller.trigger(`end_plan_flow`, [ bot, config]);
								}
								
							});
						});

					});

				} else {

					// user has not started a day recently
					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						convo.say("You haven't started a day yet!");
						convo.next();

						convo.on('end', (convo) => {
							controller.trigger(`new_plan_flow`, [ bot, { SlackUserId }]);
						});
					});

				}

			});
		});

	})

	/**
	 * 		ENDING YOUR PLAN
	 */
	controller.on(`end_plan_flow`, (bot, config) => {

		const { SlackUserId } = config;

		let wonDay = true;
		if (typeof config.wonDay != `undefined` && !config.wonDay)
			wonDay = config.wonDay;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			const UserId = user.id;
			const { nickName, wantsPing, pingTime, SlackUser: { tz } } = user;

			user.getSessionGroups({
				order: `"SessionGroup"."createdAt" DESC`,
				limit: 1
			})
			.then((sessionGroups) => {

				let sessionGroup = sessionGroups[0];
				let valid        = true;

				if (!sessionGroup || sessionGroup.type == "end_work") {
					valid = false;
				}

				if (valid) {

					user.getSessionGroups({
						order: `"SessionGroup"."createdAt" DESC`,
						where: [`"SessionGroup"."type" = ?`, "end_work"]
					})
					.then((sessionGroups) => {

						let wonDayStreak = 0;
						sessionGroups.some((sessionGroup) => {
							// count up backwards chronologically,
							// until we hit a point user did not win day
							if (!sessionGroup.wonDay) {
								return true;
							} else {
								wonDayStreak++;
							}
						});

						// include today!
						if (wonDay)
							wonDayStreak++;

						user.getDailyTasks({
							where: [`"DailyTask"."createdAt" > ? AND "DailyTask"."type" = ?`, sessionGroup.dataValues.createdAt, "live"],
							include: [ models.Task ],
							order: `"DailyTask"."priority" ASC`
						})
						.then((dailyTasks) => {

							dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");

							// user has not started a day recently
							bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

								convo.dayEnd = {
									tz,
									wantsPing,
									pingTime,
									wonDay,
									wonDayStreak,
									nickName,
									dailyTasks,
									reflection: null
								}

								startEndPlanConversation(convo);
								convo.next();

								convo.on('end', (convo) => {

									const { wonDay, reflection, wantsPing, pingTime } = convo.dayEnd;
									let now = moment();

									// end your day
									models.SessionGroup.create({
										type: `end_work`,
										UserId,
										reflection,
										wonDay
									});

									closeOldRemindersAndSessions(user);
									resumeQueuedReachouts(bot, { SlackUserId });
									user.getDailyTasks({
										where: [`"DailyTask"."type" = ?`, "live"]
									})
									.then((dailyTasks) => {
										let DailyTaskIds = dailyTasks.map(dailyTask => dailyTask.id);
										if (DailyTaskIds.length > 0) {
											models.DailyTask.update({
												type: "archived"
											}, {
												where: [ `"DailyTasks"."id" IN (?)`, DailyTaskIds ]
											});
										}
									})

									models.User.update({
										pingTime,
										wantsPing
									}, {
										where: [ `"id" = ?`, UserId]
									});

								});

							});

						});
					})

				} else {

					// user has not started a day recently
					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						convo.say("You haven't started a day yet!");
						convo.next();

						convo.on('end', (convo) => {
							controller.trigger(`new_plan_flow`, [ bot, { SlackUserId }]);
						});
					});

				}

			});

		});

	})

}
