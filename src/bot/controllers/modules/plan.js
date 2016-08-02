import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput, convertTaskNumberStringToArray, getMostRecentTaskListMessageToUpdate, deleteConvoAskMessage, convertResponseObjectToNewTaskArray, getTimeToTaskTextAttachmentWithTaskListMessage, commaSeparateOutTaskArray, getNewPlanAttachments } from '../../lib/messageHelpers';
import { constants, colorsHash, buttonValues, taskListMessageNoButtonsAttachment } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, witDurationToMinutes, mapTimeToTaskArray, getSlackUsersFromString } from '../../lib/miscHelpers';

/**
 * 		NEW PLAN CONVERSATION FLOW FUNCTIONS
 */

export function startNewPlanFlow(convo) {

	const { task: { bot }, newPlan: { daySplit, onboardVersion } } = convo;
	let { newPlan: { prioritizedTasks } }                      = convo;

	let contextDay = "today";
	if (daySplit != constants.MORNING.word) {
		contextDay = `this ${daySplit}`;
	}
	let question = `What are the 3 outcomes you want to make happen ${contextDay}?`;
	if (onboardVersion) {
		question = `${question} Please enter each one in a separate message`;
	}

	prioritizedTasks = [];
	let options = { dontShowMinutes: true, dontCalculateMinutes: true };
	let taskListMessage;
	convo.ask({
		text: question,
		attachments: getNewPlanAttachments(prioritizedTasks)
	},
	[
		{
			pattern: buttonValues.redoTasks.value,
			callback: function(response, convo) {

				prioritizedTasks               = [];
				convo.newPlan.prioritizedTasks = prioritizedTasks;

				convo.say("Okay! Let's try this again :repeat:");
				startNewPlanFlow(convo);
				convo.next();

			}
		},
		{
			pattern: utterances.onlyNeverMind,
			callback: function(response, convo) {

				convo.say("Okay! Let me know when you're ready to plan :wave:");
				convo.newPlan.exitEarly = true;
				convo.next();

			}
		},
		{
			pattern: utterances.done,
			callback: function(response, convo) {

				convo.newPlan.prioritizedTasks = prioritizedTasks;

				if (onboardVersion) {
					convo.say(`Excellent! Now let's choose the priority to work on first`);
					convo.say(`Unless you have a deadline, I recommend asking yourself *_"If this were the only thing I accomplished today, would I be satisfied for the day?_*"`);
				} else {
					convo.say(`Excellent!`);
				}

				chooseFirstTask(convo);
				convo.next();

			}
		},
		{ // this is additional task added in this case.
			default: true,
			callback: function(response, convo) {

				const updateTaskListMessageObject = getMostRecentTaskListMessageToUpdate(response.channel, bot);

				let newTaskArray = convertResponseObjectToNewTaskArray(response);
				newTaskArray.forEach((newTask) => {
					prioritizedTasks.push(newTask);
				});

				taskListMessage = convertArrayToTaskListMessage(prioritizedTasks, options);

				updateTaskListMessageObject.text = `${question}\n${taskListMessage}`;

				let attachments = getNewPlanAttachments(prioritizedTasks);

				if (prioritizedTasks.length < 3) {
					updateTaskListMessageObject.attachments = JSON.stringify(attachments);
					bot.api.chat.update(updateTaskListMessageObject);
				} else {

					while (prioritizedTasks.length > 3) {
						// only 3 priorities!
						prioritizedTasks.pop();
					}

					// we move on, with default to undo.
					updateTaskListMessageObject.attachments = JSON.stringify(taskListMessageNoButtonsAttachment);
					bot.api.chat.update(updateTaskListMessageObject);

					convo.newPlan.prioritizedTasks = prioritizedTasks;

					if (onboardVersion) {
						convo.say(`Excellent! Now let's choose a priority to work on`);
						convo.say(`Unless you have a deadline, I recommend asking yourself *_"If this were the only thing I accomplished today, would I be satisfied for the day?_*"`);
					} else {
						convo.say(`Excellent!`);
					}

					chooseFirstTask(convo);
					convo.next();

				}
				
			}
		}
	]);

}

function chooseFirstTask(convo, question = '') {

	const { task: { bot }, newPlan: { daySplit, onboardVersion } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	if (question == '') // this is the default question!
		question = `Which of your ${prioritizedTasks.length} priorities do you want to work on first?`;

	if (prioritizedTasks.length == 1) {
		// no need to choose if 1 task
		convo.newPlan.startTask.index = 0;
		getTimeToTask(convo);
	} else {

		// 2+ tasks means choosing one
		let options         = { dontShowMinutes: true, dontCalculateMinutes: true };
		let taskListMessage = convertArrayToTaskListMessage(prioritizedTasks, options);

		convo.ask({
			text: `${question}\n${taskListMessage}`,
			attachments: [
				{
					attachment_type: 'default',
					callback_id: "REDO_TASKS",
					fallback: "Do you want to work on this task?",
					color: colorsHash.grey.hex,
					actions: [
						{
								name: buttonValues.redoMyPriorities.name,
								text: "Redo my priorities!",
								value: buttonValues.redoMyPriorities.value,
								type: "button"
						}
					]
				}
			]
		}, [
			{
				pattern: utterances.containsRedo,
				callback: (response, convo) => {

					convo.say("Okay! Let's try this again :repeat:");
					startNewPlanFlow(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.containsNumber,
				callback: (response, convo) => {

					let taskNumbersToWorkOnArray = convertTaskNumberStringToArray(response.text, prioritizedTasks);
					let taskIndexToWorkOn        = taskNumbersToWorkOnArray[0] - 1;

					if (taskIndexToWorkOn >= 0) {
						if (taskNumbersToWorkOnArray.length == 1) {
							convo.newPlan.startTask.index = taskIndexToWorkOn;
							getTimeToTask(convo);
						} else {
							// only one at a time
							convo.say("Let's work on one priority at a time!");
							let question = "Which one do you want to start with?";
							chooseFirstTask(convo, question);
						}
						
					} else {
						convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
						let question = "Which of these do you want to start off with?";
						chooseFirstTask(convo, question);
					}

					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {
					convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
					convo.repeat();
					convo.next();
				}
			}
		]);
	}

}

function getTimeToTask(convo) {

	const { tz, daySplit, onboardVersion, startTask } = convo.newPlan;
	let { newPlan: { prioritizedTasks } }              = convo;

	let taskString = prioritizedTasks[startTask.index].text;

	// not used right now
	let attachments = [];
	if (prioritizedTasks.length > 1) {
		attachments.push({
			attachment_type: 'default',
			callback_id: "CHANGE_TASK",
			fallback: "Do you want to work on a different task?",
			color: colorsHash.grey.hex,
			actions: [
				{
						name: buttonValues.workOnDifferentTask.name,
						text: "Different task instead",
						value: buttonValues.workOnDifferentTask.value,
						type: "button"
				}
			]
		});
	}


	let timeExample = moment().tz(tz).add(90, "minutes").format("h:mma");

	if (onboardVersion) {
		convo.say(`Boom :boom:! Let's put our first focused work session towards \`${taskString}\``);
		convo.say(`This isn't necessarily how long you think each task will take -- instead, think of it as dedicated time towards your most important things for the day. This structure helps you *enter flow* more easily, as well as *protect your time* from yourself and others`);
		convo.say(`If you aren't done with the task after your first session, you can easily start another one towards it :muscle:`);
	} else {
		convo.say("Boom! Let's do it :boom:");
	}

	// we should have helper text here as well for the first time
	// push back on 90 / 60 / 30 here... should have higher minute intervals that we then automatically put in breaks for (we can communicate here)
	convo.ask({
		text: `How long do you want to work on \`${taskString}\` for? (you can say \`for 90 minutes\` or \`until ${timeExample}\`)`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "MINUTES_SUGGESTION",
				fallback: "How long do you want to work on this task for?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.workOnTaskFor.ninetyMinutes.name,
						text: "90 minutes",
						value: buttonValues.workOnTaskFor.ninetyMinutes.value,
						type: "button"
					},
					{
						name: buttonValues.workOnTaskFor.sixtyMinutes.name,
						text: "60 minutes",
						value: buttonValues.workOnTaskFor.sixtyMinutes.value,
						type: "button"
					},
					{
						name: buttonValues.workOnTaskFor.thirtyMinutes.name,
						text: "30 minutes",
						value: buttonValues.workOnTaskFor.thirtyMinutes.value,
						type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: utterances.containsDifferent,
			callback: (response, convo) => {

				convo.say("Okay! Let's do a different task");
				let question = "What task do you want to start with instead?";
				chooseFirstTask(convo, question);
				convo.next();

			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// use wit to decipher the relative time. if no time, then re-ask
				const { intentObject: { entities: { duration, datetime } } } = response;
				let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);

				let minutes = 0;
				let now = moment();

				if (customTimeObject) {
					if (duration) {
						minutes = witDurationToMinutes(duration);
					} else {
						minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
					}
				}

				if (minutes > 0) {
					convo.say(`Got it!`);
					convo.newPlan.startTask.minutes = minutes;
					startOnTask(convo);
				} else {
					convo.say("Sorry, I didn't catch that. Let me know a time `i.e. 45 minutes`");
					convo.repeat();
				}

				convo.next();

			}
		}
	])

}

function startOnTask(convo) {

	const { tz, daySplit, onboardVersion, startTask } = convo.newPlan;
	let { newPlan: { prioritizedTasks } }         = convo;

	let timeExample = moment().tz(tz).add(10, "minutes").format("h:mma");
	convo.ask({
		text: `When would you like to start? (you can say \`in 10 minutes\` or \`at ${timeExample}\`)`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "DO_TASK_NOW",
				fallback: "Let's do it now!",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.startTaskIn.now.name,
							text: "Let's do it now!",
							value: buttonValues.startTaskIn.now.value,
							type: "button"
					},
					{
							name: buttonValues.startTaskIn.tenMinutes.name,
							text: "In 10 minutes",
							value: buttonValues.startTaskIn.tenMinutes.value,
							type: "button"
					}
				]
			}
		]}, [
		{
			pattern: utterances.containsNow,
			callback: (response, convo) => {

				convo.say("Okay! Let's do this now :punch:");
				if (onboardVersion) {
					whoDoYouWantToInclude(convo);
				}
				convo.next();

			}
		},
		{
			default: true,
			callback: (response, convo) => {

				// use wit to decipher the relative time. if no time, then re-ask
				const { intentObject: { entities: { duration, datetime } } } = response;
				var customTimeObject = witTimeResponseToTimeZoneObject(response, tz);

				let minutes;
				let now = moment();
				if (customTimeObject) {

					convo.newPlan.startTime = customTimeObject;
					if (duration) {
						minutes = witDurationToMinutes(duration);
					} else {
						minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
					}
					let timeString = customTimeObject.format("h:mm a");
					convo.say(`Okay! I'll make sure to get you at ${timeString} :timer_clock:`);
					if (onboardVersion) {
						whoDoYouWantToInclude(convo);
					}
					convo.next();

				} else {
					convo.say("Sorry, I didn't catch that. Let me know a time `i.e. let's start in 10 minutes`");
					convo.repeat();
				}

				convo.next();

			}
		}
	]);
}

function whoDoYouWantToInclude(convo) {

	const { task: { bot }, newPlan: { daySplit } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	// we only ask this for the first time they make a new plan
	// this is part of onboard flow
	convo.say("One last thing! Is there anyone you want me to notify about your daily priorities?");
	convo.say("This makes it easy for you to communicate your outcomes for today, and stay in sync with your team to ensure that you're working on your highest priority items");
	convo.ask({
		text: `Simply let me know the people you want to include by entering their handles here \`i.e. let's include @chip and @kevin\``,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "INCLUDE_NO_ONE",
				fallback: "Who do you want to include?",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.include.noOne.name,
							text: "No one for now!",
							value: buttonValues.include.noOne.value,
							type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: utterances.containsNoOne,
			callback: (response, convo) => {

				convo.say("Okay, you can always add this later by asking me to `update settings`!");
				convo.next();

			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { text } = response;

				let includeSlackUserIds = getSlackUsersFromString(text);

				if (includeSlackUserIds) {
					models.SlackUser.findAll({
						where: [ `"SlackUser"."SlackUserId" IN (?)`, includeSlackUserIds],
						include: [ models.User ]
					})
					.then((slackUsers) => {

						let userNames = slackUsers.map(slackUser => slackUser.dataValues.User.nickName );
						let finalSlackUserIdsToInclude = slackUsers.map(slackUser => slackUser.dataValues.SlackUserId );

						convo.newPlan.includeSlackUserIds = finalSlackUserIdsToInclude;
						let userNameStrings               = commaSeparateOutTaskArray(userNames);

						convo.say(`Great! I'll notify ${userNameStrings} about your daily priorities from now on`);
						convo.say("If you want to change who you include, you can always `update settings`!");
						convo.next();

					})
				} else {
					convo.say("You didn't include any users! I pick up who you want to include by their slack handles, like `@kevin`");
					convo.repeat();
				}

				convo.next();

			}
		}
	]);

}

/**
 * 		IRRELEVANT FOR CURRENT INTERATION
 */
function prioritizeTasks(convo, question = '') {

	const { task: { bot }, newPlan: { daySplit, onboardVersion } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	if (question == '') // this is the default question!
		question = `How would you rank your ${prioritizedTasks.length} priorities in order of most meaningful to your day?`;

	if (prioritizedTasks.length == 1) {
		// 1 task needs no prioritizing
		convo.newPlan.startTask.index = 0;
		getTimeToTask(convo);
	} else {
		// 2+ tasks need prioritizing
		let options         = { dontShowMinutes: true, dontCalculateMinutes: true };
		let taskListMessage = convertArrayToTaskListMessage(prioritizedTasks, options);

		convo.ask({
			text: `${question}\n${taskListMessage}`,
			attachments: [
				{
					attachment_type: 'default',
					callback_id: "KEEP_TASK_ORDER",
					fallback: "Let's keep this task order!",
					color: colorsHash.grey.hex,
					actions: [
						{
								name: buttonValues.keepTaskOrder.name,
								text: "Keep this order!",
								value: buttonValues.keepTaskOrder.value,
								type: "button"
						}
					]
				}
			]
		}, [
			{
				pattern: utterances.containsKeep,
				callback: (response, convo) => {

					convo.say("This order looks great to me, too!");
					convo.next();

				}
			},
			{
				default: true,
				callback: (response, convo) => {

					console.log("\n\n keep stuff");
					console.log(response.text);

					let taskNumbersToWorkOnArray = convertTaskNumberStringToArray(response.text, prioritizedTasks);

					let necessaryNumbers = [];
					for (let i = 0; i < prioritizedTasks.length; i++) {
						let number = i+1;
						necessaryNumbers.push(number);
					}

					let newPrioritizedTaskNumbers = taskNumbersToWorkOnArray.slice();
					// this tests if the arrays contain the same values or not
					if (taskNumbersToWorkOnArray.sort().join(',') === necessaryNumbers.sort().join(',')) {

						let newPrioritizedTasks = [];
						newPrioritizedTaskNumbers.forEach((taskNumber) => {
							let index = taskNumber - 1;
							newPrioritizedTasks.push(prioritizedTasks[index]);
						});
						convo.newPlan.prioritizedTasks = newPrioritizedTasks;
						
						convo.say("Love it!");
						if (onboardVersion) {
							whoDoYouWantToInclude(convo);
						}

					} else {

						necessaryNumbers.reverse();
						let numberString = necessaryNumbers.join(", ");
						convo.say("Sorry, I didn't catch that");
						let repeatQuestion = `Let me know how you would rank your ${prioritizedTasks.length} priorities in order of importance by listing the numbers \`i.e. ${numberString}\``
						prioritizeTasks(convo, repeatQuestion);

					}

					convo.next();

				}
			}
		]);
	}
}

