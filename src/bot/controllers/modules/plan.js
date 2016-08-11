import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput, convertTaskNumberStringToArray, getMostRecentTaskListMessageToUpdate, deleteConvoAskMessage, convertResponseObjectToNewTaskArray, getTimeToTaskTextAttachmentWithTaskListMessage, commaSeparateOutTaskArray, getNewPlanAttachments, getRandomApprovalWord } from '../../lib/messageHelpers';
import { constants, colorsHash, buttonValues, taskListMessageNoButtonsAttachment } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, witDurationToMinutes, mapTimeToTaskArray, getSlackUsersFromString } from '../../lib/miscHelpers';

/**
 * 		NEW PLAN CONVERSATION FLOW FUNCTIONS
 */

export function startNewPlanFlow(convo) {

	const { task: { bot }, newPlan: { SlackUserId, daySplit, onboardVersion } } = convo;
	convo.newPlan.prioritizedTasks = [];

	let contextDay = "today";
	if (daySplit != constants.MORNING.word) {
		contextDay = `this ${daySplit}`;
	}

	let question = `Let’s win ${contextDay}! What are up to 3 priorities you want to work toward today? These are the important outcomes that you want to put time toward achieving today, not necessarily specific tasks you want to check off your todo list`;
	if (onboardVersion) {
		question = `${question} Please enter each one in a separate message`;
	}

	addPriorityToList(convo);

}

// function to add a priority to your plan
// this dynamically handles 1st, 2nd, 3rd priorities
function addPriorityToList(convo) {

	let { newPlan: { prioritizedTasks } } = convo;

	let count       = prioritizedTasks.length;
	let countString = '';
	let actions     = [];

	switch (count) {
		case 0:
			countString = 'first';
			break;
		case 1:
			countString = 'second';
			actions = [
				{
					name: buttonValues.newPlan.noMorePriorities.name,
					text: "No more priorities",
					value: buttonValues.newPlan.noMorePriorities.value,
					type: "button"
				},
				{
					name: buttonValues.newPlan.redoLastPriority.name,
					text: "Redo last priority",
					value: buttonValues.newPlan.redoLastPriority.value,
					type: "button"
				}
			];
			break;
		case 2:
			countString = 'third';
			actions = [
				{
					name: buttonValues.newPlan.noMorePriorities.name,
					text: "No more priorities",
					value: buttonValues.newPlan.noMorePriorities.value,
					type: "button"
				},
				{
					name: buttonValues.newPlan.redoLastPriority.name,
					text: "Redo last priority",
					value: buttonValues.newPlan.redoLastPriority.value,
					type: "button"
				}
			];
			break;
		default: break;
	};

	let attachments = [{
		attachment_type: 'default',
		callback_id: "ADD_PRIORITY",
		fallback: "Do you want to add another priority?",
		color: colorsHash.grey.hex,
		actions
	}];
	let message = `What is the ${countString} priority you want to work towards today?`

	convo.ask({
		text: message,
		attachments
	}, [
		{
			pattern: utterances.redo,
			callback: function(response, convo) {

				if (prioritizedTasks.length > 0) {
					let task = prioritizedTasks.pop();
					convo.say(`Okay! I removed \`${task.text}\` from your list`);
				}
				convo.newPlan.prioritizedTasks = prioritizedTasks;
				addPriorityToList(convo);
				convo.next();

			}
		},
		{
			pattern: utterances.noMore,
			callback: function(response, convo) {

				includeTeamMembers(convo);
				convo.next();

			}
		},
		{ // this is additional task added in this case.
			default: true,
			callback: function(response, convo) {

				const { text } = response;
				const newTask = {
					text,
					newTask: true
				};
				prioritizedTasks.push(newTask);

				let approvalWord = getRandomApprovalWord({ upperCase: true });
				let message = `${approvalWord}! I added \`${newTask.text}\``;
				if (prioritizedTasks.length % 2 == 0) {
					message = `${message} to your plan`
				}
				convo.say(message);

				convo.newPlan.prioritizedTasks = prioritizedTasks;

				if (prioritizedTasks.length >= 3) {
					includeTeamMembers(convo);
				} else {
					// ask again!
					addPriorityToList(convo);
				}

				convo.next();

			}
		}
	])

}

function includeTeamMembers(convo) {

	const { task: { bot }, newPlan: { SlackUserId, daySplit, onboardVersion, includeTeamMembers } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	let options         = { dontShowMinutes: true, dontCalculateMinutes: true };
	let taskListMessage = convertArrayToTaskListMessage(prioritizedTasks, options);

	convo.say(`Now let’s view your plan for today :pencil::\n${taskListMessage}`);

	// say who is getting included
	models.SlackUser.find({
		where: [`"SlackUserId" = ?`, SlackUserId]
	})
	.then((slackUser) => {

		let responseMessage = `Excellent!`;

		if (slackUser) {

			slackUser.getIncluded({
				include: [ models.User ]
			})
			.then((includedSlackUsers) => {

				if (includedSlackUsers.length > 0) {

					// user has team members to include!!
					let names       = includedSlackUsers.map(includedSlackUser => includedSlackUser.dataValues.User.nickName);
					let nameStrings = commaSeparateOutTaskArray(names);
					responseMessage = `I'll be sharing your plan with *${nameStrings}* when you're done :raised_hands:`;
					convo.say(responseMessage);
					if (onboardVersion) {
						explainTimeToPriorities(convo);
					} else {
						addTimeToPriorities(convo);
					}

				} else if (includeTeamMembers) {

					// user wants to include members!!!
					askToIncludeTeamMembers(convo);

				} else {

					// user does not want to include members
					convo.say(responseMessage);
					if (onboardVersion) {
						explainTimeToPriorities(convo);
					} else {
						addTimeToPriorities(convo);
					}
					convo.next();

				}

				convo.next();

			})

		} else {

			convo.say(responseMessage);
			if (onboardVersion) {
				explainTimeToPriorities(convo);
			} else {
				addTimeToPriorities(convo);
			}
			convo.next();

		}

	})

}

// add time to each of your priorities
function addTimeToPriorities(convo) {

	const { task: { bot }, newPlan: { SlackUserId, daySplit, onboardVersion, includeTeamMembers } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	convo.say(`ADDING TIME TO PRIORITIES!`);

}

// thoroughly explain why we're doing this!
function explainTimeToPriorities(convo) {

	const { task: { bot }, newPlan: { SlackUserId, daySplit, onboardVersion, includeTeamMembers } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	let priorityString = prioritizedTasks.length == 1 ? `${prioritizedTasks.length} priority` : `${prioritizedTasks.length} priorities`;

	convo.say(`Now let’s decide how much time to spend toward each of your ${priorityString}`);

	let text = `This is *how long you’d like to work on each priority for the course of the day*, from 30 minutes to 4 hours or more`;
	let attachments = [{
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		color: colorsHash.grey.hex,
		actions: [
			{
				name: buttonValues.next.name,
				text: "Why do this?",
				value: buttonValues.next.value,
				type: "button"
			}
		]
	}];

	convo.ask({
		text,
		attachments
	}, (response, convo) => {

		text = `I’ll help you hold yourself accountable and *deliberately put time toward your main outcomes in chunks* that actually make sense for you and how you enter flow`;
		attachments[0].actions[0].text = `I might misestimate!`;

		convo.ask({
			text,
			attachments
		}, (response, convo) => {

			text = `If you finish sooner than expected, that’s fantastic! If it takes longer than expected, you can always extend time later`;
			attachments[0].actions[0].text = `What gets shared?`;

			convo.ask({
				text,
				attachments
			}, (response, convo) => {

				text = `I don’t communicate how long you spend working toward your outcomes to anyone else but you, so you can feel safe about your pace and time to getting the most important things done`;
				convo.say(text);
				text = `*You define time well spent for yourself* and my goal is to help you follow through on it and actually build useful pictures of your day`;
				attachments[0].actions[0].text = `Sounds great!`;

				convo.ask({
					text,
					attachments
				}, (response, convo) => {

					addTimeToPriorities(convo);
					convo.next();

				});

				convo.next();

			});

			convo.next();

		});

		convo.next();
	});

}

function askToIncludeTeamMembers(convo) {

	const { task: { bot }, newPlan: { SlackUserId, daySplit, onboardVersion, includeTeamMembers } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	let message = `Would you like to share your plan with a colleague? *Just mention a Slack username* like \`@emily\` and I’ll share your priorities with them`;

	if (onboardVersion) {
		convo.say(message);
		message = `This makes it easy to communicate your outcomes for today, and make sure that you're working on the highest priority items for yourself and your team`;
	};

	let attachments = [{
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		color: colorsHash.grey.hex,
		actions: [
			{
				name: buttonValues.notToday.name,
				text: "Not today!",
				value: buttonValues.notToday.value,
				type: "button"
			},
			{
				name: buttonValues.noDontAskAgain.name,
				text: "No - dont ask again",
				value: buttonValues.noDontAskAgain.value,
				type: "button"
			},
			{
				name: buttonValues.newPlan.redoLastPriority.name,
				text: "Redo last priority",
				value: buttonValues.newPlan.redoLastPriority.value,
				type: "button"
			}
		]
	}];

	convo.ask({
		text: message,
		attachments
	}, [
		{
			pattern: utterances.notToday,
			callback: function(response, convo) {

				convo.say(`Okay! Let's not include anyone for today`);
				if (onboardVersion) {
					explainTimeToPriorities(convo);
				} else {
					addTimeToPriorities(convo);
				}
				convo.next();

			}
		},
		{
			pattern: utterances.noDontAskAgain,
			callback: function(response, convo) {

				convo.newPlan.dontIncludeAnyonePermanent = true;
				convo.say(`No worries! I won’t ask again. You can add someone to receive your priorities when you make them by saying \`show settings\``);
				if (onboardVersion) {
					explainTimeToPriorities(convo);
				} else {
					addTimeToPriorities(convo);
				}
				convo.next();

			}
		},
		{
			pattern: utterances.redo,
			callback: function(response, convo) {

				if (prioritizedTasks.length > 0) {
					let task = prioritizedTasks.pop();
					convo.say(`Okay! I removed \`${task.text}\` from your list`);
				}
				convo.newPlan.prioritizedTasks = prioritizedTasks;
				addPriorityToList(convo);
				convo.next();

			}
		},
		{
			default: true,
			callback: function(response, convo) {

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

						convo.say(`Great! After planning, I'll let *${userNameStrings}*  know that you’ll be focused on these priorities today`);
						convo.say("You can add someone to receive your priorities automatically when you make them each morning by saying `show settings`");
						if (onboardVersion) {
							explainTimeToPriorities(convo);
						} else {
							addTimeToPriorities(convo);
						}
						convo.next();

					})
				} else {

					convo.say("You didn't include any users! I pick up who you want to include by their slack handles, like `@fulton`");
					convo.repeat();

				}

				convo.next();

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

							let taskString = prioritizedTasks[convo.newPlan.startTask.index].text;

							if (onboardVersion) {
								convo.say(`Boom :boom:! Let's put our first focused work session towards \`${taskString}\``);
								convo.say(`This isn't necessarily how long you think each task will take -- instead, think of it as dedicated time towards your most important things for the day. This structure helps you *enter flow* more easily, as well as *protect your time* from yourself and others`);
								convo.say(`If you aren't done with the task after your first session, you can easily start another one towards it :muscle:`);
							} else {
								convo.say("Boom! Let's do it :boom:");
							}

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

	// we should have helper text here as well for the first time
	// push back on 90 / 60 / 30 here... should have higher minute intervals that we then automatically put in breaks for (we can communicate here)
	convo.ask({
		text: `How much time do you want to allocate towards \`${taskString}\` today? (you can also say \`for 90 minutes\` or \`until ${timeExample}\`)`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "MINUTES_SUGGESTION",
				fallback: "How long do you want to work on this task for?",
				color: colorsHash.grey.hex,
				actions: [
					{
						name: buttonValues.workOnTaskFor.ninetyMinutes.name,
						text: "120 minutes",
						value: "120 minutes",
						type: "button"
					},
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

	const { tz, daySplit, onboardVersion, startTask, SlackUserId } = convo.newPlan;
	let { newPlan: { prioritizedTasks } }         = convo;

	let timeExample = moment().tz(tz).add(10, "minutes").format("h:mma");
	let taskString = prioritizedTasks[startTask.index].text;
	convo.ask({
		text: `When do you want to get started on \`${taskString}\`? (you can also say \`in 10 minutes\` or \`at ${timeExample}\`)`,
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

				convo.say(`You're crushing this ${daySplit} :punch:`);
				convo.newPlan.startNow = true;
				if (onboardVersion) {
					// whoDoYouWantToInclude(convo);
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
					convo.say(`Okay! I'll see you at ${timeString} to get started :timer_clock:`);
					if (onboardVersion) {
						// whoDoYouWantToInclude(convo);
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
							// whoDoYouWantToInclude(convo);
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

