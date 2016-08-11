import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { utterances } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertToSingleTaskObjectArray, prioritizeTaskArrayFromUserInput, convertTaskNumberStringToArray, convertResponseObjectToNewTaskArray, getTimeToTaskTextAttachmentWithTaskListMessage, commaSeparateOutTaskArray, getNewPlanAttachments, getRandomApprovalWord, convertMinutesToHoursString } from '../../lib/messageHelpers';
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
				if (prioritizedTasks.length % 2 != 0) {
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

	const { task: { bot }, newPlan: { SlackUserId, daySplit, onboardVersion, includeTeamMembers, dontIncludeOthers } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	let options         = { dontShowMinutes: true, dontCalculateMinutes: true };
	let taskListMessage = convertArrayToTaskListMessage(prioritizedTasks, options);

	convo.say(`Here's your plan for today :pencil::\n${taskListMessage}`);

	// say who is getting included
	models.SlackUser.find({
		where: [`"SlackUserId" = ?`, SlackUserId]
	})
	.then((slackUser) => {

		let responseMessage = `Excellent!`;

		if (slackUser && !dontIncludeOthers) {

			slackUser.getIncluded({
				include: [ models.User ]
			})
			.then((includedSlackUsers) => {

				if (includedSlackUsers.length > 0) {

					// user has team members to include!!
					let names       = includedSlackUsers.map(includedSlackUser => includedSlackUser.dataValues.User.nickName);
					let nameStrings = commaSeparateOutTaskArray(names);
					convo.say(`I'll be sharing your plan with *${nameStrings}* when you're done :raised_hands:`);
					if (onboardVersion) {
						explainTimeToPriorities(convo);
					} else {
						addTimeToPriorities(convo);
					}

				} else {

					// user wants to include members!!!
					askToIncludeTeamMembers(convo);

				}

				convo.next();

			})

		} else {

			if (onboardVersion) {
				explainTimeToPriorities(convo);
			} else {
				addTimeToPriorities(convo);
			}
			convo.next();

		}

	})

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

				convo.say(`Okay! I won't include anyone for today's plan`);
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

// add time to each of your priorities
function addTimeToPriorities(convo) {

	const { task: { bot }, newPlan: { tz, SlackUserId, daySplit, onboardVersion, includeTeamMembers } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	let count       = 0;
	let countString = '';

	prioritizedTasks.some((prioritizedTask) => {
		if (!prioritizedTask.minutes) {
			return true;
		}
		count++;
	});

	let prioritizedTask = prioritizedTasks[count];
	if (count == 0) {
		convo.say(`Let's start to put this together now :hammer:`);
	}

	if (count >= prioritizedTasks.length) { // count should never be greater, but this is a safety measure

		startOnFirstTask(convo);
		convo.next();

	} else {

		let text = `How much time do you want to put toward \`${prioritizedTask.text}\` today?`;
		let attachments = [{
			attachment_type: 'default',
			callback_id: "REDO_PRIORITIES",
			fallback: "Do you want to redo priorities?",
			color: colorsHash.grey.hex,
			actions: []
		}];

		if (count == 0) {
			attachments[0].actions.push({
				name: buttonValues.redoMyPriorities.name,
				text: "Redo my priorities!",
				value: buttonValues.redoMyPriorities.value,
				type: "button"
			})
		} else {
			attachments[0].actions.push({
				name: buttonValues.goBack.name,
				text: "Wait, go back!",
				value: buttonValues.goBack.value,
				type: "button"
			})
		}

		convo.ask({
			text,
			attachments
		}, [
			{
				pattern: utterances.containsRedo,
				callback: (response, convo) => {

					convo.say("Okay! Let's redo your priorities! :repeat:");
					convo.newPlan.prioritizedTasks = [];
					convo.newPlan.onboardVersion   = false;
					addPriorityToList(convo);
					convo.next();

				}
			},
			{
				pattern: utterances.goBack,
				callback: (response, convo) => {

					if (count > 0) {
						convo.say("Okay! Let's go back");
						count--;
						delete prioritizedTasks[count].minutes;
						convo.newPlan.prioritizedTasks = prioritizedTasks;
						addTimeToPriorities(convo);
					} else {
						convo.say(`You can't go back on your first task!`);
						convo.repeat();
					}

					convo.next();

				}
			},
			{
				default: true,
				callback: (response, convo) => {
					
					// use wit to decipher the relative time. if no time, then re-ask
					const { text, intentObject: { entities: { duration, datetime } } } = response;
					let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);

					let minutes = 0;
					let now     = moment();

					let isNum = /^\d+$/.test(text);

					if (isNum) { // if user just says "45"
						minutes = parseInt(text);
					} else if (customTimeObject) {
						if (duration) {
							minutes = witDurationToMinutes(duration);
						} else {
							minutes = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());
						}
					}

					console.log(`\n\n\nminutes to ${prioritizedTask.text}: ${minutes}\n\n\n`);

					if (minutes > 0) {

						let timeString = convertMinutesToHoursString(minutes);
						convo.say(`Got it! I set ${timeString} to \`${prioritizedTask.text}\` :stopwatch:`);
						prioritizedTask.minutes               = minutes;
						convo.newPlan.prioritizedTasks[count] = prioritizedTask;
						addTimeToPriorities(convo);

					} else {

						convo.say("Sorry, I didn't catch that. Let me know a time `i.e. 1 hour 45 minutes`");
						convo.repeat();

					}

					convo.next();

				}
			}
		]);
	}

}

// thoroughly explain why we're doing this!
function explainTimeToPriorities(convo) {

	const { task: { bot }, newPlan: { SlackUserId, daySplit, onboardVersion, includeTeamMembers } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	let priorityString = prioritizedTasks.length == 1 ? `your ${prioritizedTasks.length} priority` : `each of your ${prioritizedTasks.length} priorities`;

	convo.say(`Now let's put time to spend toward ${priorityString}`);
	convo.say(`Since this is your first time with me, let me briefly explain what's going on :grin:`);

	let text = `This is *how long you’d like to work on each priority for the course of the day*, from 30 minutes to 4 hours or more`;
	let attachments = [{
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		color: colorsHash.green.hex,
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

// start on the first task, with opportunity to change priority
function startOnFirstTask(convo) {

	const { task: { bot }, newPlan: { tz, SlackUserId, daySplit, onboardVersion, includeTeamMembers } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	const prioritizedTask = prioritizedTasks[0];

	let message = `Let's get the day started with \`${prioritizedTask.text}\` :muscle:. When do you want to start?`;

	let attachments = [{
		attachment_type: 'default',
		callback_id: "INCLUDE_TEAM_MEMBER",
		fallback: "Do you want to include a team member?",
		color: colorsHash.grey.hex,
		actions: [
			{
				name: buttonValues.now.name,
				text: "Now! :horse_racing:",
				value: buttonValues.now.value,
				type: "button"
			},
			{
				name: buttonValues.inTenMinutes.name,
				text: "In 10 min :timer_clock:",
				value: buttonValues.inTenMinutes.value,
				type: "button"
			}
		]
	}];

	if (prioritizedTasks.length > 1) {
		attachments[0].actions.push({
			name: buttonValues.changePriority.name,
			text: "Do Different Priority",
			value: buttonValues.changePriority.value,
			type: "button"
		})
	}

	convo.ask({
		text: message,
		attachments
	}, [
		{
			pattern: utterances.containsNow,
			callback: (response, convo) => {

				convo.say(`You're crushing this ${daySplit} :punch:`);
				convo.newPlan.startNow = true;
				convo.next();

			}
		},
		{
			pattern: utterances.changePriority,
			callback: (response, convo) => {

				chooseFirstTask(convo);
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
					convo.next();

				} else {
					convo.say("Sorry, I didn't catch that. Let me know a time `i.e. let's start in 10 minutes`");
					convo.repeat();
				}

				convo.next();

			}
		}
	]);

	convo.next();

}

// this moves the chosen task as your #1 priority
function chooseFirstTask(convo, question = '') {

	const { task: { bot }, newPlan: { daySplit, onboardVersion } } = convo;
	let { newPlan: { prioritizedTasks } } = convo;

	if (question == '') // this is the default question!
		question = `Which of your ${prioritizedTasks.length} priorities do you want to work on first?`;

	if (prioritizedTasks.length == 1) {
		// no need to choose if 1 task
		startOnFirstTask(convo);
	} else {

		// 2+ tasks means you can choose your #1 priority
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
					convo.newPlan.prioritizedTasks = [];
					addPriorityToList(convo);
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

							// move that one to front of array (top priority)
							prioritizedTasks.move(taskIndexToWorkOn, 0);
							convo.newPlan.prioritizedTasks = prioritizedTasks;
							convo.say(`Sounds great to me!`);
							startOnFirstTask(convo);

						} else {
							// only one at a time
							convo.say("Let's work on one priority at a time!");
							let question = "Which one do you want to start with?";
							chooseFirstTask(convo, question);
						}
						
					} else {
						convo.say("Sorry, I didn't catch that. Let me know a number `i.e. priority 2`");
						let question = "Which of these do you want to start off with?";
						chooseFirstTask(convo, question);
					}

					convo.next();
				}
			},
			{
				default: true,
				callback: (response, convo) => {
					convo.say("Sorry, I didn't catch that. Let me know a number `i.e. priority 2`");
					convo.repeat();
					convo.next();
				}
			}
		]);
	}

}


