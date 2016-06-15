import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { randomInt } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';
import { createMomentObjectWithSpecificTimeZone } from '../../lib/miscHelpers';

// START OF A WORK SESSION
export default function(controller) {

	/**
	 *
	 * 		User directly asks to start a session
	 * 							~* via Wit *~
	 * 		
	 */
	controller.hears(['start_session'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
				convo.startSession = false;
				convo.ask(`Ready to jump into another session?`, [
					{
						pattern: bot.utterances.yes,
						callback: (response, convo) => {
							convo.startSession = true;
							convo.next();
						}
					},
					{
						pattern: bot.utterances.no,
						callback: (response, convo) => {
							convo.say("Okay! Let me know when you want to jump in :swimmer:");
							convo.next();
						}
					}
				]); 
				convo.on('end', (convo) => {
					if (convo.startSession) {
						controller.trigger(`confirm_new_session`, [ bot, { SlackUserId } ]);
					}
				});
			});
		}, 1000);

	});

	/**
	 * 				EVERY CREATED SESSION GOES THROUGH THIS FIRST
	 *   		*** this checks if there is an existing open session ***
	 *   			if no open sessions => `begin_session`
	 *   			else => go through this flow
	 */
	controller.on(`confirm_new_session`, (bot, config) => {

		/**
		 * 		User can either:
		 * 			1. Keep going
		 * 			2. Start new session by ending this one early
		 * 					- update endTime in session to now
		 * 					- mark it as done and re-enter `begin_session`
		 */

		const { SlackUserId } = config;
		console.log("in `confirm_new_session` before entering begin_session flow!");

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			user.getWorkSessions({
				where: [`"open" = ?`, true ]
			})
			.then((workSessions) => {

				// this means you have 1+ open work sessions (should only be 1)
				if (workSessions.length > 0) {

					var openWorkSession = workSessions[0]; // deal with first one as reference point

					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						var endTime       = moment(openWorkSession.endTime);
						var endTimeString = endTime.format("h:mm a");
						var now           = moment();
						var minutesLeft   = Math.round(moment.duration(endTime.diff(now)).asMinutes());


						convo.say(`You are already in a session right now! You have ${minutesLeft} minutes left :timer_clock:`);
						convo.ask(`Do you want to \`keep going\`, or cancel it and start a \`new session\`?`, (response, convo) => {

							var responseMessage = response.text;
							var { intentObject: { entities } } = response;

							var newSession = new RegExp(/(((^st[tart]*))|(^ne[ew]*)|(^se[ession]*))/); // `start` or `new`
							var keepGoing = new RegExp(/(((^k[ep]*))|(^go[oing]*))/); // `keep` or `going`

							if (newSession.test(responseMessage)) {

								// start new session
								convo.say("Got it. Let's do a new session :facepunch:");
								convo.startNewSession = true;

							} else if (keepGoing.test(responseMessage)) {

								// continue current session
								convo.say("Got it. Let's do it! :weight_lifter:");
								convo.say(`I'll ping you at ${endTimeString} :alarm_clock:`);

							} else {

								// invalid
								convo.say("I'm sorry, I didn't catch that :dog:");
								convo.repeat();

							}

							convo.next();

						});

						convo.on('end', (convo) => {

							if (convo.startNewSession) {

								var nowTimeStamp = moment().format("YYYY-MM-DD HH:mm:ss");

								// end current work session early
								openWorkSession.update({
									endTime: nowTimeStamp,
									open: false
								});

								// cancel all open work sessions since you're starting over
								workSessions.forEach((workSession) => {
									workSession.update({
										open: false
									})
								});

								controller.trigger(`begin_session`, [ bot, { SlackUserId }]);

							}
						});

					});

					return;
				}
				else {
					// good to go!
					controller.trigger(`begin_session`, [ bot, { SlackUserId }]);
					return;
				}
			});

		})


	});

	/**
	 * 		ACTUAL START SESSION FLOW
	 * 		this will begin the start_session flow with user
	 *
	 * 			- start work session
	 * 			- show and decide tasks to work on
	 * 			- decide session duration
	 */
	controller.on('begin_session', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		}).then((user) => {

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name = user.nickName || user.email;

				// configure necessary properties on convo object
				convo.name = name;

				// object that contains values important to this conversation
				convo.sessionStart = {
					UserId: user.id,
					SlackUserId
				};

				// temporary fix to get tasks
				var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");

				// FIND DAILY TASKS, THEN START THE CONVERSATION
				user.getDailyTasks({
					where: [`"DailyTask"."createdAt" > ? AND "Task"."done" = ?`, timeAgoForTasks, false],
					order: `"priority" ASC`,
					include: [ models.Task ]
				}).then((dailyTasks) => {

						console.log("your tasks for the day!");
						console.log(dailyTasks);

						// save the daily tasks for reference
						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
						convo.sessionStart.dailyTasks = dailyTasks;

						// user needs to enter daily tasks
						if (dailyTasks.length == 0) {
							convo.sessionStart.noDailyTasks = true;
							convo.stop();
						} else {
							// entry point of thy conversation
							startSessionStartConversation(err, convo);
						}
						
				});

				// on finish convo
				convo.on('end', (convo) => {

					var responses        = convo.extractResponses();
					var { sessionStart } = convo;
					var { SlackUserId } = sessionStart;

					// proxy that some odd bug has happened
					if (sessionStart.dailyTasks.length > 0 && !sessionStart.calculatedTimeObject) {

						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
							convo.say("Sorry but something went wrong :dog:. Let me know if you want to `start a session` again");
							convo.next();
						});
						
						return;
					}

					if (convo.status == 'completed') {

						console.log("finished and this is the data:");
						console.log(sessionStart);

						/**
						 * 		1. tell user time and tasks to work on
						 * 		
						 *		2. save responses to DB:
						 *			session:
						 *				- tasks to work on (tasksToWorkOnArray)
						 *				- sessionEndTime (calculated)
						 *				- reminder (time + possible customNote)
						 *
						 * 		3. start session
						 */

						var { UserId, SlackUserId, dailyTasks, calculatedTime, calculatedTimeObject, tasksToWorkOnArray, checkinTimeObject, reminderNote } = sessionStart;

						var taskObjectsToWorkOnArray = [];
						dailyTasks.forEach((dailyTask) => {
							if (tasksToWorkOnArray.indexOf(dailyTask.dataValues.priority) > -1)
								taskObjectsToWorkOnArray.push(dailyTask);
						});

						// if user wanted a reminder
						if (checkinTimeObject) {
							var checkInTimeStamp = checkinTimeObject.format("YYYY-MM-DD HH:mm:ss");
							models.Reminder.create({
								remindTime: checkInTimeStamp,
								UserId,
								customNote: reminderNote
							});
						}

						// 1. create work session 
						// 2. attach the daily tasks to work on during that work session
						var startTime = moment().format("YYYY-MM-DD HH:mm:ss");
						var endTime   = calculatedTimeObject.format("YYYY-MM-DD HH:mm:ss");
						models.WorkSession.create({
							startTime,
							endTime,
							UserId
						}).then((workSession) => {

							var dailyTaskIds = taskObjectsToWorkOnArray.map((dailyTask) => {
								return dailyTask.dataValues.id;
							})
							workSession.setDailyTasks(dailyTaskIds
								);
						});

						var taskListMessage = convertArrayToTaskListMessage(taskObjectsToWorkOnArray);

						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
							convo.say(`Excellent! See you at ${calculatedTime}! :timer_clock:`);
							convo.say(`Good luck with: \n${taskListMessage}`);
							convo.next();
						});

					} else {

						// ending convo prematurely

						if (sessionStart.noDailyTasks) {

							const { task }                = convo;
							const { bot, source_message } = task;

							bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
								convo.say("Hey! You haven't entered any tasks yet today. Let's start the day before doing a session :muscle:");
								convo.next();
								convo.on('end', (convo) => {
									// go to start your day from here
									var config = { SlackUserId };
									controller.trigger('begin_day_flow', [bot, config]);
								})
							});
							
						} else {
							// default premature end
							bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
								convo.say("Okay! Exiting now. Let me know when you want to start on a session");
								convo.next();
							});
						}

					}
				});

			});


		});

	});

}

// user just started conversation and is choosing which tasks to work on
function startSessionStartConversation(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { UserId, dailyTasks }  = convo.sessionStart;

	convo.say(`Which tasks would you like to work on?`);

	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	convo.say(taskListMessage);
	convo.say("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`");
	convo.say("I'll follow up with you when your task should be completed, based on your estimate :wink:");

	askWhichTasksToWorkOn(response, convo);
	convo.next();


}

// confirm user for the tasks and 
function askWhichTasksToWorkOn(response, convo) {
	convo.ask("I recommend working for at least 30 minutes at a time, so if you want to work on shorter tasks, try to pick several to get over that 30 minute threshold :smiley:", (response, convo) => {
		confirmTasks(response, convo);
		convo.next();
	}, { 'key' : 'tasksToWorkOn' });
}

function confirmTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { dailyTasks }          = convo.sessionStart;
	var { tasksToWorkOn }         = convo.responses;
	var tasksToWorkOnSplitArray   = tasksToWorkOn.text.split(/(,|and)/);

	// if we capture 0 valid tasks from string, then we start over
	var numberRegEx = new RegExp(/[\d]+/);
	var tasksToWorkOnArray = [];
	tasksToWorkOnSplitArray.forEach((taskString) => {
		console.log(`task string: ${taskString}`);
		var taskNumber = taskString.match(numberRegEx);
		if (taskNumber) {
			taskNumber = parseInt(taskNumber[0]);
			if (taskNumber <= dailyTasks.length) {
				tasksToWorkOnArray.push(taskNumber);
			}
		}
	});

	// invalid if we captured no tasks
	var isInvalid = (tasksToWorkOnArray.length == 0 ? true : false);
	var taskListMessage = convertArrayToTaskListMessage(dailyTasks);

	// repeat convo if invalid w/ informative context
	if (isInvalid) {
		convo.say("Oops, I don't totally understand :dog:. Let's try this again");
		convo.say("You can either work on one task by saying `let's work on task 1` or multiple tasks by saying `let's work on tasks 1, 2, and 3`");
		convo.say(taskListMessage);
		askWhichTasksToWorkOn(response, convo);
		return;
	}

	convo.ask(`To :heavy_check_mark:, you want to work on tasks: ${tasksToWorkOnArray.join(", ")}?`,[
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.sessionStart.tasksToWorkOnArray = tasksToWorkOnArray;
				confirmTimeForTasks(response,convo);
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say("Let's give this another try then :repeat_one:");
				convo.say(taskListMessage);
				askWhichTasksToWorkOn(response, convo);
				convo.next();
			}
		}
	]);

}

// calculate ask about the time to the given tasks
function confirmTimeForTasks(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { tasksToWorkOnArray, dailyTasks }  = convo.sessionStart;
	const SlackUserId = response.user;

	console.log("convo sessino start:");
	console.log(convo.sessionStart);

	var totalMinutes = 0;
	dailyTasks.forEach((dailyTask) => {
		if (tasksToWorkOnArray.indexOf(dailyTask.dataValues.priority) > -1) {
			console.log("tasksToWorkOnArray:");
			console.log(tasksToWorkOnArray);
			console.log("this specific daily task:");
			console.log(dailyTask);
			var { dataValues: { minutes } } = dailyTask;
			totalMinutes += parseInt(minutes);
		}
	});

	// get timezone of user before continuing
	// we aren't putting this in helper function b/c of this convo's custom CB
	bot.api.users.list({
  	presence: 1
  }, (err, response) => {
  	const { members } = response; // members are all users registered to your bot

  	for (var i = 0; i < members.length; i++) {
  		if (members[i].id == SlackUserId) {
  			var timeZoneObject = {};
  			timeZoneObject.tz = members[i].tz;
  			timeZoneObject.tz_label = members[i].tz_label;
  			timeZoneObject.tz_offset = members[i].tz_offset;
  			convo.sessionStart.timeZone = timeZoneObject;
  			break;
  		}
  	}

  	var { timeZone } = convo.sessionStart;
  	if (timeZone && timeZone.tz) {
  		timeZone = timeZone.tz;
  	} else {
  		timeZone = "America/New_York"; // THIS IS WRONG AND MUST BE FIXED
  		// SOLUTION IS MOST LIKELY TO ASK USER HERE WHAT THEIR TIMEZONE IS.
  	}
  	console.log(`Your timezone is: ${timeZone}`);
  	var calculatedTimeObject = moment().tz(timeZone).add(totalMinutes, 'minutes')
  	var calculatedTimeString = calculatedTimeObject.format("h:mm a");
  	convo.say(`Nice! That should take until ${calculatedTimeString} based on your estimate`);
  	convo.ask(`Would you like to work until ${calculatedTimeString}?`, [
			{
				pattern: bot.utterances.yes,
				callback: (response, convo) => {

					// success! now save session time info for the user
					convo.sessionStart.totalMinutes         = totalMinutes;
					convo.sessionStart.calculatedTime       = calculatedTimeString;
					convo.sessionStart.calculatedTimeObject = calculatedTimeObject;

					askForCheckIn(response, convo);
					convo.next();
				}
			},
			{
				pattern: bot.utterances.no,
				callback: (response, convo) => {
					askForCustomTotalMinutes(response, convo);
					convo.next();
				}
			}
		]);

  });

}

// ask for custom amount of time to work on
function askForCustomTotalMinutes(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	convo.ask("What time would you like to work until? You can also tell me the duration you'd like to work, like `55 minutes` :upside_down_face:", (response, convo) => {

		var { intentObject: { entities } } = response;
		// for time to tasks, these wit intents are the only ones that makes sense
		if (entities.duration || entities.custom_time) {
			confirmCustomTotalMinutes(response, convo);
		} else {
			// invalid
			convo.say("I'm sorry, I didn't catch that :dog:");
			convo.repeat();
		}

		convo.next();

	});

};

function confirmCustomTotalMinutes(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	var { timeZone: { tz } } = convo.sessionStart;

	// use Wit to understand the message in natural language!
	var { intentObject: { entities } } = response;
	var customTimeObject; // moment object of time
	var customTimeString; // format to display (`h:mm a`)
	var customTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)
	if (entities.duration) {

		var durationArray = entities.duration;
		var durationSeconds = 0;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);

		// add minutes to now
		customTimeObject = moment().tz(tz).add(durationSeconds, 'seconds');
		customTimeString = customTimeObject.format("h:mm a");

	} else if (entities.custom_time) {
		// get rid of timezone to make it tz-neutral
		// then create a moment-timezone object with specified timezone
		var timeStamp = entities.custom_time[0].value;

		// create time object based on user input + timezone
		customTimeObject = createMomentObjectWithSpecificTimeZone(timeStamp, tz);
		customTimeString = customTimeObject.format("h:mm a");

	}

	convo.ask(`So you'd like to work until ${customTimeString}?`, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {

				var now             = moment();
				var minutesDuration = Math.round(moment.duration(customTimeObject.diff(now)).asMinutes());

				// success! now save session time info for the user
				convo.sessionStart.totalMinutes         = minutesDuration;
				convo.sessionStart.calculatedTime       = customTimeString;
				convo.sessionStart.calculatedTimeObject = customTimeObject;

				askForCheckIn(response, convo);
				convo.next();

			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.ask("Yikes, my bad. Let's try this again. Just tell me how many minutes (`ex. 45 min`) or until what time (`ex. 3:15pm`) you'd like to work right now", (response, convo) => {
					confirmCustomTotalMinutes(response, convo);
					convo.next();
				});
				convo.next();
			}
		}
	]);

}

// ask if user wants a checkin during middle of session
function askForCheckIn(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const { tasksToWorkOnArray, dailyTasks }  = convo.sessionStart;
	const SlackUserId = response.user;

	convo.ask("Boom :boom: Would you like me to check in with you during this session to make sure you're on track?", [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.say("Sure thing! Let me know what time you want me to check in with you");
				convo.ask("I can also check in a certain number of minutes or hours from now, like `40 minutes` or `1 hour`", (response, convo) => {

					var { intentObject: { entities } } = response;
					// for time to tasks, these wit intents are the only ones that makes sense
					if (entities.duration || entities.custom_time) {
						confirmCheckInTime(response, convo);
					} else {
						// invalid
						convo.say("I'm sorry, I didn't catch that :dog:");
						convo.say("Please put either a time like `2:41pm`, or a number of minutes or hours like `35 minutes`");
						convo.silentRepeat();
					}

					convo.next();

				}, { 'key' : 'respondTime' });
				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.next();
			}
		}
	]);

}

// confirm check in time with user
function confirmCheckInTime(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	var { timeZone: { tz } } = convo.sessionStart;

	// use Wit to understand the message in natural language!
	var { intentObject: { entities } } = response;
	var checkinTimeObject; // moment object of time
	var checkinTimeString; // format to display (`h:mm a`)
	var checkinTimeStringForDB; // format to put in DB (`YYYY-MM-DD HH:mm:ss`)
	if (entities.duration) {

		var durationArray = entities.duration;
		var durationSeconds = 0;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);

		// add minutes to now
		checkinTimeObject = moment().tz(tz).add(durationSeconds, 'seconds');
		checkinTimeString = checkinTimeObject.format("h:mm a");

	} else if (entities.custom_time) {
		// get rid of timezone to make it tz-neutral
		// then create a moment-timezone object with specified timezone
		var timeStamp = entities.custom_time[0].value;

		// create time object based on user input + timezone
		checkinTimeObject = createMomentObjectWithSpecificTimeZone(timeStamp, tz);
		checkinTimeString = checkinTimeObject.format("h:mm a");

	}

	convo.ask(`I'll be checking in with you at ${checkinTimeString}. Is that correct?`, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {

				var now             = moment();
				var minutesDuration = Math.round(moment.duration(checkinTimeObject.diff(now)).asMinutes());

				// success! now save checkin time info for the user
				convo.sessionStart.checkinTimeObject = checkinTimeObject;
				convo.sessionStart.checkinTimeString = checkinTimeString;
				
				askForReminderDuringCheckin(response, convo);
				convo.next();

			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.say(`Let's rewind :vhs: :rewind:`);
				convo.ask("What time would you like me to check in with you? Just tell me a time or a certain number of minutes from the start of your session you'd like me to check in", (response, convo) => {
					confirmCheckInTime(response, convo);
					convo.next();
				});
				convo.next();
			}
		}
	]);


}

function askForReminderDuringCheckin(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	convo.say("Last thing - is there anything you'd like me to remind you during the check in?");
	convo.ask("This could be a note like `call Mary` or `should be on the second section of the proposal by now`", [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {
				convo.ask(`What note would you like me to remind you about?`, (response, convo) => {
					getReminderNoteFromUser(response, convo);
					convo.next();
				});

				convo.next();
			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				// we are assuming anything else is the reminderNote
				getReminderNoteFromUser(response, convo);
				convo.next();
			}
		}
	], { 'key' : 'reminderNote' });

}

function getReminderNoteFromUser(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	const SlackUserId = response.user;

	const note = response.text;

	const { sessionStart: { checkinTimeObject, checkinTimeString } } = convo;

	convo.ask(`Does this look good: \`${note}\`?`, [
		{
			pattern: bot.utterances.yes,
			callback: (response, convo) => {

				convo.sessionStart.reminderNote = note;
				convo.next();

			}
		},
		{
			pattern: bot.utterances.no,
			callback: (response, convo) => {
				convo.ask(`Just tell me a one-line note and I'll remind you about it at ${checkinTimeString}!`, (response, convo) => {
					getReminderNoteFromUser(response, convo);
					convo.next();
				})
				convo.next();
			}
		}
	]);

}
