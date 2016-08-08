import moment from 'moment-timezone';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertTimeStringToMinutes, convertTaskNumberStringToArray, deleteConvoAskMessage, convertMinutesToHoursString, getMinutesSuggestionAttachments } from '../../lib/messageHelpers';
import { dateStringToMomentTimeZone, witTimeResponseToTimeZoneObject, witDurationToMinutes, witDurationToTimeZoneObject, getDailyTaskForSession } from '../../lib/miscHelpers';

import intentConfig from '../../lib/intents';
import { randomInt, utterances } from '../../lib/botResponses';
import { colorsArray, THANK_YOU, buttonValues, colorsHash, startSessionOptionsAttachments, pausedSessionOptionsAttachments } from '../../lib/constants';

/**
 * 		START WORK SESSION CONVERSATION FLOW FUNCTIONS
 */

/**
 *    ENTRY POINTS INTO THE ACTUAL SESSION (FINALIZE CONFIRM)
 */

// confirm task and time in one place and start if it's good
export function finalizeTimeAndTasksToStart(convo) {

	const { SlackUserId, tz, dailyTask, calculatedTimeObject, minutes, currentSession }  = convo.sessionStart;
	let now = moment();

	// we need both time and task in order to start session
	if (!dailyTask) {
		askWhichTaskToWorkOn(convo);
		return;
	} else if (!calculatedTimeObject || !minutes) {
		confirmTimeForTask(convo);
		return;
	}

	// will only be a single task now
	let taskText = dailyTask.dataValues ? `\`${dailyTask.dataValues.Task.text}\`` : 'your task';

	// will only be a single task now
	let timeString     = convertMinutesToHoursString(minutes);
	let calculatedTime = calculatedTimeObject.format("h:mma");

	let question = `Ready to work on ${taskText} for ${timeString} until *${calculatedTime}*?`;

	// already in session, can only be in one
	if (currentSession) {

		if (currentSession.isPaused) {
			question = `You're in a *paused* session for \`${currentSession.sessionTasks}\` and have *${currentSession.minutesString}* remaining! Would you like to cancel that and start a new session instead?`;
		} else {
			question = `You're currently in a session for \`${currentSession.sessionTasks}\` and have *${currentSession.minutesString}* remaining! Would you like to cancel that and start a new session instead?`;
		}
			
		convo.ask(question, [
			{
				pattern: utterances.yes,
				callback: (response, convo) => {
					convo.sessionStart.confirmOverRideSession = true;
					convo.say(`Okay, sounds good to me!`);
					convo.next();
				}
			},
			{
				pattern: utterances.no,
				callback: (response, convo) => {

					let text = '';
					let attachments = [];

					if (currentSession.isPaused) {
						text        = `Got it. Let me know when you want to *resume* and get going again :arrow_forward:!`;
						attachments = pausedSessionOptionsAttachments;
					} else {
						text        = `Okay! Keep it up and I'll see you in ${currentSession.minutesString} :weight_lifter:`;
						attachments = startSessionOptionsAttachments;
					}

					convo.say({
						text,
						attachments
					});

					convo.next();

				}
			},
			{
				default: true,
				callback: (response, convo) => {
					convo.say("Sorry, I didn't catch that");
					convo.repeat();
					convo.next();
				}
			}
		]);

	} else {

		// normal flow for starting a session

		const { minutes, minutesSpent } = dailyTask.dataValues;
		let minutesRemaining            = minutes - minutesSpent;

		if (minutesRemaining > 0) {

			if (minutesSpent == 0) {
				// new flow!
				convo.say(`Let’s crank on ${taskText} with a focused session :wrench:`);
				question = `How long would you like to focus on ${taskText} for? You have *${minutesRemaining} minutes* set aside for this today`;
			} else {
				// new flow!
				convo.say(`Let’s keep cranking on ${taskText} with a focused session :wrench:`);
				question = `How long would you like to focus on ${taskText} for? You still have *${minutesRemaining} minutes* set aside for this today`;
			}
			
			let attachments = getMinutesSuggestionAttachments(minutesRemaining);

			convo.ask({
				text: question,
				attachments
			},
			[
				{
					pattern: utterances.containsChangeTask,
					callback: function(response, convo) {
						convo.say("Okay, let's change tasks!");
						askWhichTaskToWorkOn(convo);
						convo.next();
					}
				},
				{
					pattern: utterances.noAndNeverMind,
					callback: function(response, convo) {

						convo.sessionStart.confirmStart = false;
						if (currentSession) {
							convo.say({
								text: `Okay! Good luck on \`${currentSession.sessionTasks}\`. See you at *${currentSession.endTimeString}* :weight_lifter:`,
								attachments: startSessionOptionsAttachments
							});
						} else {
							convo.say("Okay, let me know if you still want to start a `new session` for one of your priorities :grin:");
						}
						convo.next();

					}
				},
				{ // if duration or date, then we can start
					default: true,
					callback: function(response, convo) {

					let { intentObject: { entities } } = response;

					let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);

					if (customTimeObject) {
						let minutes          = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

						convo.sessionStart.calculatedTimeObject = customTimeObject;
						convo.sessionStart.minutes              = minutes;
						convo.sessionStart.confirmStart         = true;

						convo.next();

					} else {
						convo.say("I didn't quite get that :thinking_face:");
						convo.repeat();
						convo.next();
					}

				}
			}
		]);

		} else {

			confirmTimeForTask(convo);
			convo.next();

		}
	}

}

/**
 *    CHOOSE TASK
 */

// ask which tasks the user wants to work on
function askWhichTaskToWorkOn(convo, question = '') {

	// this should only be said FIRST_TIME_USER
	// convo.say("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:");

	const { SlackUserId, dailyTasks, dailyTask }  = convo.sessionStart;

	if (!dailyTasks) {
		getUserDailyTasks(convo);
	} else {

		// THIS IS A TEST TO SEE IF THERE ARE EVEN WORKABLE DAILY TASKS
		let oneDailyTaskToWorkOn = getDailyTaskForSession(dailyTasks);
		if (!oneDailyTaskToWorkOn) {
			// THIS SHOULD NEVER HAPPEN
			convo.say(`You don't have any more priorities to work on! You've won the day!`);
			convo.sessionStart.endDay = true;
			convo.next();
		} else {
			const { task: { bot } } = convo;
			let noDailyTask = false;
			let taskArray = dailyTasks.filter((currentDailyTask) => {
				if (!dailyTask) { // uncommon situation where reminder has no dailyTask
					noDailyTask = true;
					return true;
				} else if (currentDailyTask.dataValues.id != dailyTask.dataValues.id){
					return true;
				}
			});
			let options = { dontUsePriority: true }
			let taskListMessage = convertArrayToTaskListMessage(taskArray, options);
			if (question == '') {
				question = `Which priority would you like to work on instead?`
			}
			if (noDailyTask) question = `Which priority would you like to work on?`
			let message = `${question}\n${taskListMessage}`;
			convo.ask({
				text: message,
				attachments:[
					{
						attachment_type: 'default',
						callback_id: "START_SESSION",
						fallback: "I was unable to process your decision",
						color: colorsHash.grey.hex,
						actions: [
							{
									name: buttonValues.neverMind.name,
									text: "Never mind!",
									value: buttonValues.neverMind.value,
									type: "button",
							}
						]
					}
				]
			},[
				{
					pattern: utterances.noAndNeverMind,
					callback: (response, convo) => {
						if (dailyTask) {
							let taskText = dailyTask.dataValues ? `\`${dailyTask.dataValues.Task.text}\`` : 'your priority';
							convo.say(`Sure thing! Let's stay working on ${taskText}`);
							confirmTimeForTask(convo)
						} else {
							convo.say(`Okay! Let me know when you want to \`start a session\``);
						}
						convo.next();
					}
				},
				{
					default: true,
					callback: (response, convo) => {
						// user inputed task #'s, not new task button
						confirmTasks(response, convo, taskArray);
						convo.next();
					}
				}
			]);
		}
	}
}

function getUserDailyTasks(convo) {

	const { SlackUserId, dailyTask }  = convo.sessionStart;

	models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [ models.SlackUser ]
		})
		.then((user) => {
			user.getDailyTasks({
				where: [`"DailyTask"."type" = ?`, "live"],
				include: [ models.Task ],
				order: `"DailyTask"."priority" ASC`
			})
			.then((dailyTasks) => {
				dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
				convo.sessionStart.dailyTasks = dailyTasks;

				// here is where we will automatically suggest a dailyTask based on our specific decision
				// if we can find a dailyTask, we can go straight to confirm
				// Otherwise, we must ask user which one they want to work on
				let dailyTask = getDailyTaskForSession(dailyTasks);
				if (dailyTask) {
					convo.sessionStart.dailyTask = dailyTask;
					finalizeTimeAndTasksToStart(convo);
				} else {
					askWhichTaskToWorkOn(convo);
				}

			})
		})

}

// if user decides to work on existing tasks
function confirmTasks(response, convo, taskArray = []) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { dailyTasks }          = convo.sessionStart;

	if (taskArray.length == 0) {
		taskArray = dailyTasks;
	}

	let taskNumbersToWorkOnArray = convertTaskNumberStringToArray(response.text, taskArray);
	let taskIndexToWorkOn        = taskNumbersToWorkOnArray[0] - 1;

	if (taskIndexToWorkOn >= 0) {
		if (taskNumbersToWorkOnArray.length == 1) {
			// SUCCESS
			convo.sessionStart.dailyTask = taskArray[taskIndexToWorkOn];
			confirmTimeForTask(convo);
		} else {
			// only one at a time
			convo.say("Let's work on one priority at a time!");
			let question = "Which of your remaining priorities do you want to work on?";
			askWhichTaskToWorkOn(convo, question);
		}
		
	} else {
		convo.say("Sorry, I didn't catch that. Let me know a number `i.e. task 2`");
		let question = "Which of these do you want to work on?";
		askWhichTaskToWorkOn(convo, question);
	}

}

// calculate ask about the time to the existing tasks user chose
function confirmTimeForTask(convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { SlackUserId, tz, dailyTask }  = convo.sessionStart;

	// will only be a single task now
	let taskText = dailyTask.dataValues ? `\`${dailyTask.dataValues.Task.text}\`` : 'your priority';

	// will only be a single task now
	let minutesAllocated = dailyTask.dataValues.minutes;
	let minutesSpent     = dailyTask.dataValues.minutesSpent;

	let minutesRemaining = minutesAllocated - minutesSpent;

	if (minutesRemaining > 0) {

		let now = moment().tz(tz);
		let calculatedTimeObject = now.add(minutesRemaining, 'minutes');

		convo.sessionStart.minutes              = minutesRemaining;
		convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

		finalizeTimeAndTasksToStart(convo);

	} else {
		convo.say(`You have no time remaining for ${taskText} today!`);
		askToAddMinutesToTask(convo);
	}

	convo.next();

}

function askToAddMinutesToTask(convo) {

	const { task }                       = convo;
	const { bot, source_message }        = task;
	const { SlackUserId, tz, dailyTask } = convo.sessionStart;

	// will only be a single task now
	let taskText = dailyTask.dataValues ? `\`${dailyTask.dataValues.Task.text}\`` : 'your priority';

	convo.ask({
		text: `Do you want to complete this for today, or add time to it? (you can say something like \`2 more hours\`)`,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "START_SESSION",
				fallback: "Add more minutes to this priority?",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.doneSession.completedPriorityTonedDown.name,
							text: "Complete :sports_medal:",
							value: buttonValues.doneSession.completedPriorityTonedDown.value,
							type: "button"
					}
				]
			}
		]
	}, [
		{
			pattern: utterances.containsCompleteOrCheckOrCross,
			callback: (response, convo) => {
				convo.say(`You are a star :star:`);
				convo.sessionStart.completeDailyTask = true;
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {

				let { intentObject: { entities } } = response;
				// for time to tasks, these wit intents are the only ones that makes sense
				if (entities.duration || entities.datetime) {
					confirmCustomTotalMinutes(response, convo);
				} else {
					// invalid
					convo.say("I'm sorry, I didn't catch that :dog:");
					convo.repeat();
				}

				convo.next();

			}
		}
	]);

};

function confirmCustomTotalMinutes(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId             = response.user;
	const { tz }                  = convo.sessionStart;
	var now                       = moment().tz(tz);

	// use Wit to understand the message in natural language!
	var { intentObject: { entities } } = response;

	var customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
	var customTimeString = customTimeObject.format("h:mm a");
	let minutes          = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

	convo.sessionStart.calculatedTimeObject = customTimeObject;
	convo.sessionStart.minutes              = minutes;

	finalizeTimeAndTasksToStart(convo);

}


/**
 * 		ACTUAL START SESSION ABSTRACTION
 */

export function startSessionWithConvoObject(sessionStart) {

	// all of these constants are necessary!
	const { bot, SlackUserId, dailyTask, calculatedTimeObject, UserId, minutes } = sessionStart;

	if (!bot || !SlackUserId || !UserId || !dailyTask || !calculatedTimeObject || !minutes) {
		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
			convo.say("Uh oh, something went wrong trying to `start your session` :dog: Let me know when you want to try again!");
		});
		return;
	}

	let startTime = moment();
	if (!dailyTask.dataValues.minutes) {
		// update dailyTask minutes here cause it hasn't existed up to this point
		let DailyTaskId = dailyTask.dataValues.id;
		models.DailyTask.update({
			minutes
		}, {
			where: [`"id" = ? `, DailyTaskId ]
		});
	}
	// endTime is from when you hit start
	let endTime   = moment().add(minutes, 'minutes');

	models.WorkSession.create({
		UserId,
		startTime,
		endTime
	})
	.then((workSession) => {

		let dailyTaskIds = [dailyTask.dataValues.id];
		workSession.setDailyTasks(dailyTaskIds);

		let taskString    = dailyTask.dataValues.Task.text;
		let minutesString = convertMinutesToHoursString(minutes);
		let timeString    = endTime.format("h:mma");

		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

			convo.say("Let's do it :boom:!");
			convo.say(`Good luck with \`${taskString}\`! See you in ${minutesString} at *${timeString}*`);
			convo.say({
				text: `:weight_lifter: Your focused work session starts now :weight_lifter:`,
				attachments: startSessionOptionsAttachments
			});

		});

	})
}
