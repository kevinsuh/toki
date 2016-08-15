import os from 'os';
import { wit, resumeQueuedReachouts } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues, FINISH_WORD, RESET, taskListMessageDoneButtonAttachment, taskListMessageAddMoreTasksAndResetTimesButtonAttachment, taskListMessageAddMoreTasksButtonAttachment, pausedSessionOptionsAttachments, startSessionOptionsAttachments, constants } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertResponseObjectsToTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray, getMostRecentTaskListMessageToUpdate, getMostRecentMessageToUpdate, deleteConvoAskMessage, convertMinutesToHoursString, getTimeToTaskTextAttachmentWithTaskListMessage, deleteMostRecentTaskListMessage, deleteMostRecentPlanMessage, getPlanCommandCenterAttachments } from '../../lib/messageHelpers';

import { consoleLog, witTimeResponseToTimeZoneObject, witDurationToMinutes, mapTimeToTaskArray } from '../../lib/miscHelpers';

// this one shows the task list message and asks for options
export function startEditPlanConversation(convo) {

	const { planEdit: { dailyTasks, bot, openWorkSession, taskNumbers, planDecision } } = convo;

	/**
	 * 		We enter here to provide specific context if the user
	 * 		has an currently open work session or not. Otherwise,
	 * 		the next step is the same (`specificCommandFlow`)
	 */
	
	if (openWorkSession) {
		openWorkSession.getStoredWorkSession({
			where: [ `"StoredWorkSession"."live" = ?`, true ]
		})
		.then((storedWorkSession) => {
			openWorkSession.getDailyTasks({
				include: [ models.Task ]
			})
			.then((dailyTasks) => {

				var now           = moment();
				var endTime       = moment(openWorkSession.endTime);
				var endTimeString = endTime.format("h:mm a");
				var minutes       = Math.round(moment.duration(endTime.diff(now)).asMinutes());
				var minutesString = convertMinutesToHoursString(minutes);

				var dailyTaskTexts = dailyTasks.map((dailyTask) => {
					return dailyTask.dataValues.Task.text;
				})

				var sessionTasks = commaSeparateOutTaskArray(dailyTaskTexts);

				convo.planEdit.currentSession = {
					minutes,
					minutesString,
					sessionTasks,
					endTimeString,
					storedWorkSession
				}

				if (storedWorkSession) {
					convo.planEdit.currentSession.isPaused = true;
				}

				/**
				 * 		~~ Start of flow for specific command ~~
				 * 				* if you have an openWorkSession *
				 */
				
				specificCommandFlow(convo);
				convo.next();

			})
		});
			
	} else {

		/**
		 * 		~~ Start of flow for specific command ~~
		 * 		 * if you don't have openWorkSession *
		 */
		
		specificCommandFlow(convo);
		convo.next();

	}

}

/**
 * 		ENTRY POINT FOR VIEW / EDIT PLAN
 */
function specificCommandFlow(convo) {

	const { planEdit: { dailyTasks, bot, openWorkSession, taskNumbers, planDecision, currentSession } } = convo;

	switch (planDecision) {
		case constants.PLAN_DECISION.complete.word:
			console.log(`\n\n ~~ user wants to check off tasks in specificCommandFlow ~~ \n\n`);
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToCompleteArray = convertTaskNumberStringToArray(taskNumberString, dailyTasks);
			if (taskNumbersToCompleteArray) {
				// single line complete ability
				singleLineCompleteTask(convo, taskNumbersToCompleteArray);
			} else {
				completeTasksFlow(convo);
			}
			break;
		case constants.PLAN_DECISION.add.word:
			console.log(`\n\n ~~ user wants to add tasks in specificCommandFlow ~~ \n\n`)
			addTasksFlow(convo);
			break;
		case constants.PLAN_DECISION.view.word:
			console.log(`\n\n ~~ user wants to view tasks in specificCommandFlow ~~ \n\n`);
			viewTasksFlow(convo);
			break;
		case constants.PLAN_DECISION.delete.word:
			console.log(`\n\n ~~ user wants to delete tasks in specificCommandFlow ~~ \n\n`)
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToDeleteArray = convertTaskNumberStringToArray(taskNumberString, dailyTasks);
			if (taskNumbersToDeleteArray) {
				// single line complete ability
				singleLineDeleteTask(convo, taskNumbersToDeleteArray);
			} else {
				deleteTasksFlow(convo);
			}
			break;
		case constants.PLAN_DECISION.revise.word:
			console.log(`\n\n ~~ user wants to revise tasks in specificCommandFlow ~~ \n\n`)
			var taskNumberString = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToReviseArray = convertTaskNumberStringToArray(taskNumberString, dailyTasks);
			if (taskNumbersToReviseArray) {
				// single line complete ability
				singleLineReviseTask(convo, taskNumbersToReviseArray);
			} else {
				reviseTasksFlow(convo);
			}
			break;
		case constants.PLAN_DECISION.edit.word:
			console.log(`\n\n ~~ user wants to edit tasks in specificCommandFlow ~~ \n\n`)
			viewTasksFlow(convo);
			break;
		case constants.PLAN_DECISION.work.word:
			var taskNumberString         = taskNumbers ? taskNumbers.join(",") : '';
			var taskNumbersToWorkOnArray = convertTaskNumberStringToArray(taskNumberString, dailyTasks);

			if (taskNumbersToWorkOnArray) {
				// single line work ability
				singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);
			} else {
				workOnTasksFlow(convo);
			}
			break;
		default:
			break;
	}

	convo.next();

}

/**
 * 			~~ editTaskListFunctions Helper Messages ~~
 */
function getRemainingTasks(fullTaskArray, newTasks) {
	var remainingTasks = [];
	fullTaskArray.forEach((task) => {
		if (task.dataValues) {
			task = task.dataValues;
		};
		if (!task.done && task.type == 'live') {
			remainingTasks.push(task);
		}
	});

	if (newTasks) {
		newTasks.forEach((newTask) => {
			remainingTasks.push(newTask);
		})
	}
	return remainingTasks;
}

function sayTasksForToday(convo, options = {}) {

	// different options for 1-2 priorities vs 3 priorities

	const { planEdit: { dailyTasks, newTasks } } = convo;
	let remainingTasks = getRemainingTasks(dailyTasks, newTasks);

	options.segmentCompleted = true;

	let buttonsValuesArray = [];

	if (dailyTasks.length > 0 && dailyTasks.length < 3) {
		// 1-2 priorities

		buttonsValuesArray = [
			buttonValues.planCommands.addPriority.value,
			buttonValues.planCommands.deletePriority.value,
			buttonValues.planCommands.completePriority.value,
			buttonValues.planCommands.workOnPriority.value,
			buttonValues.planCommands.endDay.value
		];

	} else {
		// 3 priorities
		buttonsValuesArray = [
			buttonValues.planCommands.revisePriority.value,
			buttonValues.planCommands.deletePriority.value,
			buttonValues.planCommands.completePriority.value,
			buttonValues.planCommands.workOnPriority.value,
			buttonValues.planCommands.endDay.value
		];
	}

	let attachmentsConfig = { buttonsValuesArray };
	let taskListMessage   = convertArrayToTaskListMessage(dailyTasks, options);
	let attachments       = getPlanCommandCenterAttachments(attachmentsConfig);

	if (options.onlyRemainingTasks) {
		const remainingPriorityString = dailyTasks.length == 1 ? `Here is your remaining priority` : `Here are your remaining priorities`;
		convo.say(`${remainingPriorityString} for today :memo::`);
	} else {
		taskListMessage = `Here's today's plan :memo::\n${taskListMessage}`;
	}

	if (options.customTaskListMessage) {
		taskListMessage = options.customTaskListMessage;
	}

	if (remainingTasks.length > 0) {
		convo.say({
			text: taskListMessage,
			attachments
		});
	}

}

function wordSwapMessage(baseMessage, word, wordSwapCount) {

	let wordSwaps = [`${word}`,`*${word}*`,`*_${word}_*`];
	let wordSwapChoice = wordSwaps[wordSwapCount % wordSwaps.length];
	let message = `${baseMessage} ${wordSwapChoice}`;
	return message;

}

/**
 * 		~~ VIEW TASKS (HOME BASE OF PLAN) ~~
 */

function viewTasksFlow(convo) {

	let { planEdit: { bot, dailyTasks, changePlanCommand, changedPlanCommands } } = convo;

	// say task list, then ask which ones to complete
	let options = { noTitle: true, endOfPlan: true, homeBase: true };
	sayTasksForToday(convo, options);
	convo.next();

}

/**
 * 				~~ REVISE TASK ~~
 * 		this essentially deletes a task then adds one combined
 */
function singleLineReviseTask(convo, taskNumbersToReviseArray) {

	let { dailyTasks } = convo.planEdit;
	let dailyTasksToRevise = [];
	dailyTasks.forEach((dailyTask, index) => {
		const { dataValues: { priority, type, Task: { done } } } = dailyTask;
		// not already completed and is live
		if (taskNumbersToReviseArray.indexOf(priority) > -1 && !done && type == "live") {
			dailyTasksToRevise.push(dailyTask);
		}
	});

	if (dailyTasksToRevise.length > 0) {

		// add to complete array for planEdit
		let dailyTaskIdsToRevise = dailyTasksToRevise.map((dailyTask) => {
			return dailyTask.dataValues.id;
		});
		convo.planEdit.dailyTaskIdsToDelete = dailyTaskIdsToRevise;

		let dailyTaskTextsToRevise = dailyTasksToRevise.map((dailyTask) => {
			return dailyTask.dataValues.Task.text;
		});
		let dailyTasksToReviseString = commaSeparateOutTaskArray(dailyTaskTextsToRevise, { codeBlock: true });

		convo.say({
			text: `Got it -- I removed ${dailyTasksToReviseString} from your plan today`
		});
		addTasksFlow(convo);
		convo.next();

	} else {
		convo.say("I couldn't find that priority to revise!");
		reviseTasksFlow(convo);
	}

	convo.next();

}

function reviseTasksFlow(convo) {

	let { planEdit: { bot, dailyTasks, changePlanCommand, changedPlanCommands } } = convo;
	convo.planEdit.inFlow = true;

	// say task list, then ask which ones to check off
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	let baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = `Okay! Which priority above do you want to`;
	} else {
		baseMessage = `Which priority above do you want to`;
		sayTasksForToday(convo, options);
	}

	let wordSwapCount = 0;
	let message       = wordSwapMessage(baseMessage, "revise?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [ {
			attachment_type: 'default',
			callback_id: "TASK_REVISE",
			fallback: "Which priority do you want to revise?",
			actions: [
				{
					name: buttonValues.neverMind.name,
					text: `Never mind!`,
					value: buttonValues.neverMind.value,
					type: `button`
				}
			]
		}]
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {

				convo.say("Got it :thumbsup: If you need to revise a priority, just let me know");
				convo.planEdit.showUpdatedPlan = true;
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { text } = response;
				if (response.actions && response.actions[0]) {
					text = response.actions[0].value;
				}

				// if key word exists, we are stopping early and do the other flow!
				if (constants.PLAN_DECISION.add.reg_exp.test(text) || constants.PLAN_DECISION.delete.reg_exp.test(text) || constants.PLAN_DECISION.work.reg_exp.test(text) || constants.PLAN_DECISION.revise.reg_exp.test(text)) {

					changePlanCommand.decision = true;
					changePlanCommand.text     = text

				}

				if (changePlanCommand.decision) {
					convo.stop();
					convo.next();
				} else  {

					// otherwise do the expected, default decision!
					let taskNumbersToReviseArray = convertTaskNumberStringToArray(text, dailyTasks);

					if (constants.PLAN_DECISION.revise.reg_exp.test(text) && !taskNumbersToReviseArray) {

						// if user tries completing task again, just update the text
						wordSwapCount++;
						let text = wordSwapMessage(baseMessage, "revise?", wordSwapCount);
						let convoAskQuestionUpdate = getMostRecentMessageToUpdate(response.channel, bot);
						if (convoAskQuestionUpdate) {
							convoAskQuestionUpdate.text = text;
							bot.api.chat.update(convoAskQuestionUpdate);
						}

					} else {

						if (taskNumbersToReviseArray) {

							// say task list, then ask which ones to complete
							let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };

							singleLineReviseTask(convo, taskNumbersToReviseArray);

						} else {
							convo.say("Oops, I don't totally understand :dog:. Let's try this again");
							convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
							convo.repeat();
						}

						convo.next();

					}
					
				}

			}
		}
	]);

	convo.next();

}

/**
 * 		~~ COMPLETE TASKS ~~
 */

// complete the tasks requested
function singleLineCompleteTask(convo, taskNumbersToCompleteArray) {

	let { dailyTasks, dailyTaskIdsToComplete } = convo.planEdit;
	let dailyTasksToComplete = [];
	dailyTasks = dailyTasks.filter((dailyTask, index) => {
		const { dataValues: { priority, type, Task: { done } } } = dailyTask;
		let stillNotCompleted = true;
		// not already completed
		if (taskNumbersToCompleteArray.indexOf(priority) > -1 && !done && type == "live") {
			dailyTasksToComplete.push(dailyTask);
			stillNotCompleted = false;
		}
		return stillNotCompleted;
	});

	if (dailyTasksToComplete.length > 0) {

		// add to complete array for planEdit
		dailyTaskIdsToComplete = dailyTasksToComplete.map((dailyTask) => {
			return dailyTask.dataValues.id;
		});
		convo.planEdit.dailyTaskIdsToComplete = dailyTaskIdsToComplete;

		let dailyTaskTextsToComplete = dailyTasksToComplete.map((dailyTask) => {
			return dailyTask.dataValues.Task.text;
		});
		let dailyTasksToCompleteString = commaSeparateOutTaskArray(dailyTaskTextsToComplete, { codeBlock: true });

		convo.say({
			text: `Great work :punch:. I checked off ${dailyTasksToCompleteString}!`
		});

		convo.planEdit.showUpdatedPlan = true;
		convo.next();

	} else {
		convo.say("I couldn't find that priority to check off!");
		completeTasksFlow(convo);
	}

	convo.next();

}

function completeTasksFlow(convo) {

	let { planEdit: { bot, dailyTasks, changePlanCommand, changedPlanCommands } } = convo;
	convo.planEdit.inFlow = true;

	// say task list, then ask which ones to check off
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	let baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = `Okay! Which priority above did you`;
	} else {
		baseMessage = `Which priority above did you`;
		sayTasksForToday(convo, options);
	}

	let wordSwapCount = 0;
	let message       = wordSwapMessage(baseMessage, "complete?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [ {
			attachment_type: 'default',
			callback_id: "TASK_COMPLETE",
			fallback: "Which priority did you complete?",
			actions: [
				{
					name: buttonValues.neverMind.name,
					text: `Never mind!`,
					value: buttonValues.neverMind.value,
					type: `button`
				}
			]
		}]
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {

				convo.say("Got it! If you need to mark a priority as completed, just let me know");
				convo.planEdit.showUpdatedPlan = true;
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { text } = response;
				if (response.actions && response.actions[0]) {
					text = response.actions[0].value;
				}

				// if key word exists, we are stopping early and do the other flow!
				if (constants.PLAN_DECISION.add.reg_exp.test(text) || constants.PLAN_DECISION.delete.reg_exp.test(text) || constants.PLAN_DECISION.work.reg_exp.test(text) || constants.PLAN_DECISION.revise.reg_exp.test(text)) {

					changePlanCommand.decision = true;
					changePlanCommand.text     = text

				}

				if (changePlanCommand.decision) {
					convo.stop();
					convo.next();
				} else  {

					// otherwise do the expected, default decision!
					let taskNumbersToCompleteArray = convertTaskNumberStringToArray(text, dailyTasks);

					if (constants.PLAN_DECISION.complete.reg_exp.test(text) && !taskNumbersToCompleteArray) {

						// if user tries completing task again, just update the text
						wordSwapCount++;
						let text = wordSwapMessage(baseMessage, "complete?", wordSwapCount);
						let convoAskQuestionUpdate = getMostRecentMessageToUpdate(response.channel, bot);
						if (convoAskQuestionUpdate) {
							convoAskQuestionUpdate.text = text;
							bot.api.chat.update(convoAskQuestionUpdate);
						}

					} else {

						if (taskNumbersToCompleteArray) {

							// say task list, then ask which ones to complete
							let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };

							singleLineCompleteTask(convo, taskNumbersToCompleteArray);

						} else {
							convo.say("Oops, I don't totally understand :dog:. Let's try this again");
							convo.say("Please pick tasks from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
							convo.repeat();
						}

						convo.next();

					}
					
				}

			}
		}
	]);

	convo.next();

}


/**
 * 		~~ DELETE TASKS ~~
 */

function singleLineDeleteTask(convo, taskNumbersToDeleteArray) {

	let { dailyTasks, dailyTaskIdsToDelete } = convo.planEdit;
	let dailyTasksToDelete = [];
	dailyTasks = dailyTasks.filter((dailyTask, index) => {
		const { dataValues: { priority, type, Task: { done } } } = dailyTask;
		let stillNotDeleted = true;
		// not already deleted
		if (taskNumbersToDeleteArray.indexOf(priority) > -1 && type == "live" && !done) {
			dailyTasksToDelete.push(dailyTask);
			stillNotDeleted = false;
		}
		return stillNotDeleted;
	});

	if (dailyTasksToDelete.length > 0) {

		// add to delete array for planEdit
		dailyTaskIdsToDelete = dailyTasksToDelete.map((dailyTask) => {
			return dailyTask.dataValues.id;
		});
		convo.planEdit.dailyTaskIdsToDelete = dailyTaskIdsToDelete;

		let dailyTasksTextsToDelete = dailyTasksToDelete.map((dailyTask) => {
			return dailyTask.dataValues.Task.text;
		});
		let dailyTasksToDeleteString = commaSeparateOutTaskArray(dailyTasksTextsToDelete, {codeBlock: true});

		convo.say({
			text: `Sounds good, I removed ${dailyTasksToDeleteString} from your plan today!`
		});
		convo.planEdit.showUpdatedPlan = true;
		convo.next();

	} else {
		convo.say("I couldn't find that priority to remove!");
		deleteTasksFlow(convo);
	}

	convo.next();

}

function deleteTasksFlow(convo) {

	let { planEdit: { bot, dailyTasks, changePlanCommand, changedPlanCommands } } = convo;
	convo.planEdit.inFlow = true;

	// say task list, then ask which ones to complete
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, noTitle: true, startPlan: true };

	let baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = `Okay! Which priority above would you like to`;
	} else {
		baseMessage = `Which priority above would you like to`;
		sayTasksForToday(convo, options);
	}

	let wordSwapCount = 0;
	let message       = wordSwapMessage(baseMessage, "remove?", wordSwapCount);

	convo.ask({
		text: message,
		attachments: [ {
			attachment_type: 'default',
			callback_id: "TASK_REMOVE",
			fallback: "Which priority would you like to remove?",
			actions: [
				{
					name: buttonValues.neverMind.name,
					text: `Never mind!`,
					value: buttonValues.neverMind.value,
					type: `button`
				}
			]
		}]
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say("Got it :thumbsup: Let me know if you still want to `delete a priority`");
				convo.planEdit.showUpdatedPlan = true;
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { text } = response;
				if (response.actions && response.actions[0]) {
					text = response.actions[0].value;
				}

				// if key word exists, we are stopping early and do the other flow!
				if (constants.PLAN_DECISION.add.reg_exp.test(text) || constants.PLAN_DECISION.complete.reg_exp.test(text) || constants.PLAN_DECISION.work.reg_exp.test(text) || constants.PLAN_DECISION.revise.reg_exp.test(text)) {

					changePlanCommand.decision = true;
					changePlanCommand.text     = text
				}

				if (changePlanCommand.decision) {
					convo.stop();
					convo.next();
				} else {

					// otherwise do the expected, default decision!
					let taskNumbersToDeleteArray = convertTaskNumberStringToArray(response.text, dailyTasks);

					if (constants.PLAN_DECISION.delete.reg_exp.test(text) && !taskNumbersToDeleteArray) {

						// if user tries completing task again, just update the text
						wordSwapCount++;
						let text = wordSwapMessage(baseMessage, "remove?", wordSwapCount);
						let convoAskQuestionUpdate = getMostRecentMessageToUpdate(response.channel, bot);
						if (convoAskQuestionUpdate) {
							convoAskQuestionUpdate.text = text;
							bot.api.chat.update(convoAskQuestionUpdate);
						}

					} else {

						if (taskNumbersToDeleteArray) {

							singleLineDeleteTask(convo, taskNumbersToDeleteArray);

						} else {
							convo.say("Oops, I don't totally understand :dog:. Let's try this again");
							convo.say("Please pick priorities from your remaining list like `tasks 1, 3 and 4` or say `never mind`");
							convo.repeat();
						}
						convo.next();

					}
						
				}

			}
		}
	]);

	convo.next();
	
}

/**
 * 		~~ ADD TASKS ~~
 */

function addTasksFlow(convo) {

	var { source_message, planEdit: { bot, dailyTasks, newTasks, actuallyWantToAddATask, changePlanCommand } } = convo;

	// say task list, then ask for user to add tasks
	let options = { onlyRemainingTasks: true, dontCalculateMinutes: true, newTasks };
	let taskListMessage = convertArrayToTaskListMessage(dailyTasks, options);

	// cannot add more than 3 priorities for the day!
	if (dailyTasks.length >= 3) {
		convo.say(`You can only have 3 priorities for the day! This is to make sure you don't overload your todo's, and instead focus on getting the most important things done each day. You can revise or remove one of your priorities if they aren't critical anymore`);
		convo.planEdit.showUpdatedPlan = true;
		convo.next();
	} else {
		convo.ask({
			text: `Which new priority would you like me to add to your plan?`,
			attachments:[
				{
					attachment_type: 'default',
					callback_id: "ADD_PRIORITY",
					fallback: "Let's add a priority to your list!",
					actions: [
						{
							name: buttonValues.neverMind.name,
							text: `Never mind!`,
							value: buttonValues.neverMind.value,
							type: `button`
						}
					]
				}
			]
		},
		[
			{ // NL equivalent to buttonValues.neverMind.value
				pattern: utterances.noAndNeverMind,
				callback: function(response, convo) {
					convo.say("Okay!");
					let options = { dontUseDataValues: true };
					sayTasksForToday(convo, options);
					convo.next();
				}
			},
			{ // accept the priority
				default: true,
				callback: function(response, convo) {

					const { text } = response;
					convo.planEdit.newPriority = {
						text
					}

					convo.say(`Love it!`);
					addTimeToPriority(response, convo);
					convo.next();

				}
			}
		]);
	}

}

function addTimeToPriority(response, convo) {

	var { source_message, planEdit: { tz, bot, dailyTasks, newTasks, actuallyWantToAddATask, changePlanCommand, newPriority } } = convo;

	let newPriorityText = newPriority.text;

	convo.ask({
		text: `How much time would you like to put toward \`${newPriorityText}\` today?`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "TIME_TO_PRIORITY",
				fallback: "How much time to your new priority?",
				actions: [
					{
						name: buttonValues.planCommands.actuallyLetsRenamePriority.name,
						text: `Wait, let's rename`,
						value: buttonValues.planCommands.actuallyLetsRenamePriority.value,
						type: `button`
					}
				]
			}
		]
	},
	[
		{ // NL equivalent to buttonValues.neverMind.value
			pattern: utterances.noAndNeverMind,
			callback: function(response, convo) {
				convo.say("Okay!");
				let options = { dontUseDataValues: true };
				sayTasksForToday(convo, options);
				convo.next();
			}
		},
		{ // let's rename the task!
			pattern: utterances.containsRename,
			callback: function(response, convo) {
				convo.say("Okay! Let's do this again :repeat_one:");
				addTasksFlow(convo);
				convo.next();
			}
		},
		{ // make sure this is valid time
			default: true,
			callback: function(response, convo) {

				let { text, intentObject: { entities: { duration, datetime } } } = response;
				let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
				let now = moment();

				if (!customTimeObject) {
					convo.say("Sorry, I didn't get that :thinking_face:");
					convo.repeat();
				} else {

					// success and user knows time to priority!
					let durationMinutes  = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
					convo.planEdit.newPriority.minutes = durationMinutes;

					convo.say(`Great! I've added \`${newPriorityText}\` to your plan for today`);
					convo.planEdit.showUpdatedPlan = true;

				}

				convo.next();

			}
		}
	]);
}

/**
 * 		~~ WORK ON TASK ~~
 */

// confirm user wants to do work session
function singleLineWorkOnTask(convo, taskNumbersToWorkOnArray) {

	let { planEdit: { dailyTasks } } = convo;
	let dailyTasksToWorkOn = [];

	dailyTasksToWorkOn = dailyTasks.filter((dailyTask, index) => {
		const { dataValues: { priority, type, Task: { done } } } = dailyTask;
		let workOnTask = false;
		if (taskNumbersToWorkOnArray.indexOf(priority) > -1 && type == "live" && !done) {
			workOnTask = true;
		}
		return workOnTask;
	});

	if (dailyTasksToWorkOn.length > 0) {

		let taskTextsToWorkOnArray = dailyTasksToWorkOn.map((dailyTask) => {
			let text = dailyTask.dataValues ? dailyTask.dataValues.Task.text : dailyTask.text;
			return text;
		});

		convo.planEdit.dailyTasksToWorkOn = dailyTasksToWorkOn;

		let tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

		convo.planEdit.startSession = true;
		convo.say(" ");
		convo.next();

	} else {
		convo.say(`I couldn't find that priority to work on!`);
		workOnTasksFlow(convo);
	}

	convo.next();

}

// work on which task flow
function workOnTasksFlow(convo) {

	let { planEdit: { bot, dailyTasks, changePlanCommand, changedPlanCommands, openWorkSession, currentSession } } = convo;

	// say task list, then ask which ones to complete
	let options = { onlyRemainingTasks: true };

	let baseMessage = '';

	if (changedPlanCommands) {
		baseMessage = `Okay! Which priority above would you like to`;
	} else {
		baseMessage = `Which priority above would you like to`;
		sayTasksForToday(convo, options);
	}

	let wordSwap      = "work towards?";
	let wordSwapCount = 0;

	if (openWorkSession && currentSession)
		wordSwap = "work towards instead?";

	let message       = wordSwapMessage(baseMessage, wordSwap, wordSwapCount);

	convo.ask({
		text: message,
		attachments: [{
			attachment_type: 'default',
			callback_id: "CHOOSE_FROM_PLAN",
			fallback: "Which priority would you like to work towards?"
		}]
	}, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say("Okay, let me know if you still want to start a `new session` for one of your priorities :grin:");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { text } = response;
				if (response.actions && response.actions[0]) {
					text = response.actions[0].value;
				}

				if (constants.PLAN_DECISION.add.reg_exp.test(text) || constants.PLAN_DECISION.complete.reg_exp.test(text) || constants.PLAN_DECISION.delete.reg_exp.test(text) || constants.PLAN_DECISION.revise.reg_exp.test(text)) {

					// CHANGE COMMANDS
					
					changePlanCommand.decision = true;
					changePlanCommand.text     = text
					convo.stop();
					convo.next();
				} else {

					// DO EXPECTED, DEFAULT DECISION
					
					let taskNumbersToWorkOnArray = convertTaskNumberStringToArray(response.text, dailyTasks);

					if (constants.PLAN_DECISION.work.reg_exp.test(text) && !taskNumbersToWorkOnArray) {

						// if user tries completing task again, just update the text
						wordSwapCount++;
						let text = wordSwapMessage(baseMessage, wordSwap, wordSwapCount);
						let convoAskQuestionUpdate = getMostRecentMessageToUpdate(response.channel, bot);
						if (convoAskQuestionUpdate) {
							convoAskQuestionUpdate.text = text;
							bot.api.chat.update(convoAskQuestionUpdate);
						}

					} else {

						// ACTUAL FLOW OF CHOOSING TASK TO WORK ON

						if (taskNumbersToWorkOnArray) {

							// say task list, then ask which ones to complete
							let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };

							singleLineWorkOnTask(convo, taskNumbersToWorkOnArray);

						} else {
							convo.say("Oops, I don't totally understand :dog:. Please pick one priority from your remaining list like `priority 2` or say `never mind`");
							convo.repeat();
						}
						convo.next();

					}

				}

			}
		}
	]);

	convo.next();

}

// updated endOfPlan message with the appropriate context
export function endOfPlanMessage(config) {

	const { controller, bot, SlackUserId, showUpdatedPlan } = config;
	let now = moment();

	/**
	 * 		This will check for open work sessions
	 */
	models.User.find({
		where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
		include: [
			models.SlackUser
		]
	})
	.then((user) => {

		const UserId = user.id;
		const { SlackUser: { tz } } = user;

		user.getDailyTasks({
			where: [`"DailyTask"."type" = ? AND "Task"."done" = ?`, "live", false],
			include: [models.Task]
		})
		.then((dailyTasks) => {
			
			user.getWorkSessions({
				where: [`"open" = ?`, true ]
			})
			.then((workSessions) => {

				
				if (workSessions.length > 0) {

					// you are currently in an open session!

					let workSession = workSessions[0];

					let now                 = moment();
					let endTime             = moment(workSession.dataValues.endTime);
					let minutesRemaining    = Math.round(moment.duration(endTime.diff(now)).asMinutes());
					let timeRemainingString = convertMinutesToHoursString(minutesRemaining)

					workSession.getDailyTasks({
						include: [ models.Task ]
					})
					.then((dailyTasks) => {

						let dailyTask = dailyTasks[0]; // one task per session

						if (dailyTask) {
							let taskString = dailyTask.Task.text;

							if (dailyTask.type == "live" && !dailyTask.Task.done) {
								// still a live, uncompleted task! send either paused or resumed session message
								workSession.getStoredWorkSession({
									where: [ `"StoredWorkSession"."live" = ?`, true ]
								})
								.then((storedWorkSession) => {

									let attachments        = startSessionOptionsAttachments;
									let workSessionMessage = '';

									if (storedWorkSession) {
										// handle if currently paused
										minutesRemaining = storedWorkSession.dataValues.minutes;
										timeRemainingString = convertMinutesToHoursString(minutes);
										workSessionMessage = `Your session is still paused :double_vertical_bar:. `;
										attachments = pausedSessionOptionsAttachments;
									}

									bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

										workSessionMessage = `${workSessionMessage}:weight_lifter: You have ${timeRemainingString} remaining in your session for \`${taskString}\` :weight_lifter:`;
										convo.say({
											text: workSessionMessage,
											attachments
										});
										convo.next();

										convo.on('end', (convo) => {
											resumeQueuedReachouts(bot, { SlackUserId });
										});

									});

								});

							} else {

								// completed or removed the priority for your current session!
								// close the session, then update the minutes that you spent on that dailyTask
								if ( now < endTime )
									endTime = now;

								workSession.update({
									open: false,
									endTime
								})
								.then((workSession) => {

									const WorkSessionId       = workSession.id;
									let startTime             = moment(workSession.dataValues.startTime).tz(tz);
									endTime                   = moment(workSession.dataValues.endTime).tz(tz);
									let endTimeString         = endTime.format("h:mm a");
									let workSessionMinutes    = Math.round(moment.duration(endTime.diff(startTime)).asMinutes());
									let workSessionTimeString = convertMinutesToHoursString(workSessionMinutes);

									let minutesSpent = dailyTask.minutesSpent;
									minutesSpent     += workSessionMinutes;
									dailyTask.update({
										minutesSpent
									})
									.then((dailyTask) => {

										bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

											let message = '';
											if (dailyTask.dataValues.Task.done) {
												message = `Great job finishing \`${taskString}\` :raised_hands:!`;
											} else {
												message = `You are no longer working on \`${taskString}\``;
											}
											
											convo.say(message);
											convo.next();

											convo.on('end', (convo) => {
												
												let config = { SlackUserId };
												controller.trigger(`plan_command_center`, [ bot, config ]);

											});
											
										});
									});

								});

							}

						}
					});

				} else {

					// this means NO uncompleted priorities
					if (dailyTasks.length == 0) {
						// let's see if user can still add another priority today
						user.getDailyTasks({
							where: [`"DailyTask"."type" = ?`, "live"]
						})
						.then((dailyTasks) => {

							if (dailyTasks.length >= 3) {
								controller.trigger(`end_plan_flow`, [ bot, config ]);
							} else {

								// ask if want to add another priority, or end day
								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

									let prioritiesToAdd = 3 - dailyTasks.length;
									let message;
									if (prioritiesToAdd == 1) {
										message = `You can still add ${prioritiesToAdd} more priority today`
									} else {
										message = `You can still add ${prioritiesToAdd} more priorities today`
									};
									message = `${message}! Would you like to add a priority, or end your day?`
									convo.say({
										text: message,
										attachments:[
											{
												attachment_type: 'default',
												callback_id: "FINISH_PRIORITIES_STILL_REMAINING",
												fallback: "Would you like to add another priority?",
												color: colorsHash.grey.hex,
												actions: [
													{
															name: buttonValues.planCommands.addPriority.name,
															text: "Add priority :muscle:",
															value: buttonValues.planCommands.addPriority.value,
															type: "button"
													},
													{
															name: buttonValues.endDay.name,
															text: "End day",
															value: buttonValues.endDay.value,
															type: "button"
													},
												]
											}
										]
									});

								});
							}
						});
					} else if (showUpdatedPlan) {
						controller.trigger(`plan_command_center`, [ bot, config ]);
					}
				}

			});

		});
			
	});

}





/**
 * 		~~ DEPRECATED 8/9/16 ~~
 */

function getTimeToTasks(response, convo) {

	var { bot, dailyTasks, newTasks, tz } = convo.planEdit;
	var options                           = { dontShowMinutes: true, dontCalculateMinutes: true, noKarets: true };

	let taskArray = dailyTasks;
	let taskArrayType = "update";
	if (newTasks && newTasks.length > 0){
		taskArrayType = "new";
		taskArray     = newTasks;
	}

	var taskListMessage = convertArrayToTaskListMessage(taskArray, options);

	var timeToTasksArray = [];

	var mainText = "Let's add time to each of your tasks:";
	let taskTextsArray = taskArray.map((task) => {
		if (task.dataValues) {
			task = task.dataValues;
		}
		return task.text;
	})
	let attachments = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

	convo.ask({
		text: mainText,
		attachments
	},
	[
		{
			pattern: buttonValues.actuallyWantToAddATask.value,
			callback: function(response, convo) {
				convo.planEdit.actuallyWantToAddATask = true;
				addTasksFlow(convo);
				convo.next();
			}
		},
		{
			pattern: buttonValues.resetTimes.value,
			callback: (response, convo) => {

				let updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);
				if (updateTaskListMessageObject) {
					convo.planEdit.updateTaskListMessageObject = updateTaskListMessageObject;

					timeToTasksArray.pop();
					taskArray = mapTimeToTaskArray(taskArray, timeToTasksArray);

					let options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);

					attachments     = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

					updateTaskListMessageObject.text        = mainText;
					updateTaskListMessageObject.attachments = JSON.stringify(attachments);

					bot.api.chat.update(updateTaskListMessageObject);

				}

				convo.silentRepeat();
			}
		},
		{
			pattern: utterances.containsResetOrUndo,
			callback: (response, convo) => {

				let updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);
				if (updateTaskListMessageObject) {
					convo.planEdit.updateTaskListMessageObject = updateTaskListMessageObject;

					timeToTasksArray.pop();
					taskArray = mapTimeToTaskArray(taskArray, timeToTasksArray);

					options = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);

					attachments     = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

					updateTaskListMessageObject.text        = mainText;
					updateTaskListMessageObject.attachments = JSON.stringify(attachments);

					bot.api.chat.update(updateTaskListMessageObject);

				}

				convo.silentRepeat();

			}
		},
		{
			default: true,
			callback: function(response, convo) {

				const { intentObject: { entities: { reminder, duration, datetime } } } = response;

				let updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				if (updateTaskListMessageObject) {

					convo.planEdit.updateTaskListMessageObject = updateTaskListMessageObject;
					const commaOrNewLine = new RegExp(/[,\n]/);
					let timeToTasks      = response.text.split(commaOrNewLine);

					// get user string response and convert it to time!
					if (timeToTasks.length > 1) {
						// entered via comma or \n (30 min, 45 min) and requires old method
						timeToTasks.forEach((time) => {
							var minutes = convertTimeStringToMinutes(time);
							if (minutes > 0)
								timeToTasksArray.push(minutes);
						});
					} else {
						// user entered only one time (1 hr 35 min) and we can use wit intelligence
						// now that we ask one at a time, we can use wit duration
						var customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
						if (customTimeObject) {
							var minutes;
							if (duration) {
								minutes = witDurationToMinutes(duration);
							} else { // cant currently handle datetime cuz wit sucks
								minutes = convertTimeStringToMinutes(response.text);
								// this should be done through datetime, but only duration for now
								// minutes = parseInt(moment.duration(customTimeObject.diff(now)).asMinutes());
							}
						} else {
							minutes = convertTimeStringToMinutes(response.text);
						}

						if (minutes > 0)
							timeToTasksArray.push(minutes);
					}

					taskArray = mapTimeToTaskArray(taskArray, timeToTasksArray);

					// update message for the user
					options         = { dontUseDataValues: true, emphasizeMinutes: true, noKarets: true };
					taskListMessage = convertArrayToTaskListMessage(taskArray, options);
					attachments     = getTimeToTaskTextAttachmentWithTaskListMessage(taskTextsArray, timeToTasksArray.length, taskListMessage);

					updateTaskListMessageObject.text        = mainText;
					updateTaskListMessageObject.attachments = JSON.stringify(attachments);

					bot.api.chat.update(updateTaskListMessageObject);

					if (timeToTasksArray.length >= taskArray.length) {
						if (taskArrayType = "new") {
							convo.planEdit.newTasks = taskArray;
						} else if (taskArrayType = "update") {
							convo.planEdit.dailyTasksToUpdate = taskArray;
						}
						confirmTimeToTasks(convo);
						convo.next();
					}

				}
			}
		}
	]);

}

function saveNewTaskResponses(tasksToAdd, convo) {

	// get the newTasks!
	var { dailyTasks, newTasks } = convo.planEdit;

	if (tasksToAdd) {

		// only get the new tasks
		var tasksArray = [];
		tasksToAdd.forEach((task) => {
			if (task.newTask) {
				tasksArray.push(task);
			}
		})
		var tasksToAddArray = convertResponseObjectsToTaskArray(tasksArray);
		if (!dailyTasks) {
			dailyTasks = [];
		}

		tasksToAddArray.forEach((newTask) => {
			newTasks.push(newTask);
		})

		convo.planEdit.dailyTasks = dailyTasks; // all daily tasks
		convo.planEdit.newTasks   = newTasks; // only the new ones

	}

	convo.next();
}

// used for both edit time to tasks, as well as add new tasks!!
function confirmTimeToTasks(convo) {

	var { dailyTasks, dailyTasksToUpdate, newTasks } = convo.planEdit;

	convo.ask("Are those times right?", [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {

				convo.say("Excellent!");

				// you use this function for either ADDING tasks or UPDATING tasks (one or the other)
				if (newTasks.length > 0) {
					// you added new tasks and are confirming time for them
					addNewTasksToTaskList(response, convo);
				} else if (dailyTasksToUpdate.length > 0) {

					// say task list, then ask which ones to complete
					let options = { dontUseDataValues: true, onlyRemainingTasks: true, endOfPlan: true };
					sayTasksForToday(convo, options);

				}

				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {

				convo.say("Let's give this another try :repeat_one:");
				convo.say("Just say time estimates, like `30, 1 hour, or 15 min` and I'll figure it out and assign times to the tasks above in order :smiley:");

				if (newTasks.length > 0) {
					getTimeToTasks(response, convo);
				} else if (dailyTasksToUpdate.length > 0) {
					editTaskTimesFlow(response, convo);
				}
				
				convo.next();
			}
		}
	]);
}

function addNewTasksToTaskList(response, convo) {
	// combine the newTasks with dailyTasks
	var { dailyTasks, newTasks } = convo.planEdit;

	var taskArray = [];
	dailyTasks.forEach((task) => {
		taskArray.push(task);
	})
	newTasks.forEach((newTask) => {
		taskArray.push(newTask);
	});

	var taskListMessage = convertArrayToTaskListMessage(taskArray, {onlyRemainingTasks: true});

	// say task list, then ask which ones to complete
	let options = { dontUseDataValues: true, onlyRemainingTasks: true, customTaskListMessage: taskListMessage };
	sayTasksForToday(convo, options);

	convo.next();

}

/**
 * 		~~ END OF DEPRECATED FUNCTIONS 8/9/16 ~~
 */