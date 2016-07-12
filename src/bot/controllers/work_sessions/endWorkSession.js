import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes, convertTaskNumberStringToArray, commaSeparateOutTaskArray } from '../../lib/messageHelpers';
import { closeOldRemindersAndSessions } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { bots } from '../index';

import { colorsArray, buttonValues, colorsHash, TOKI_DEFAULT_SNOOZE_TIME, sessionTimerDecisions, MINUTES_FOR_DONE_SESSION_TIMEOUT } from '../../lib/constants';

// END OF A WORK SESSION
export default function(controller) {

	/**
	 * 		ENDING WORK SESSION:
	 * 			1) Explict command to finish session early
	 * 			2) Your timer has run out
	 */

	// User wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', wit.hears, (bot, message) => {

		/**
		 * 			check if user has open session (should only be one)
		 * 					if yes, trigger finish and end_session flow
		 * 			  	if no, reply with confusion & other options
		 */
		
		const SlackUserId = message.user;
		console.log("done message:");
		console.log(message);

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {

			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {
				return user.getWorkSessions({
					where: [ `"open" = ?`, true ]
				});
			})
			.then((workSessions) => {
				// if live work session, confirm end early
				// else, user MUST say `done` to trigger end (this properly simulates user is done with that session)
				if (workSessions.length > 0) {
					bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
						convo.ask(`Are you finished with your session?`, [
							{
								pattern: utterances.yes,
								callback: (response, convo) => {
									convo.say("You are a star! :star:");
									convo.finishedWithSession = true;
									convo.next();
								}
							},
							{
								pattern: utterances.no,
								callback: (response, convo) => {
									convo.say(`Oh, never mind then! Keep up the work :weight_lifter:`);
									convo.next();
								}
							}
						]);
						convo.on('end', (convo) => {
							if (convo.finishedWithSession) {
								controller.trigger('end_session', [bot, { SlackUserId }]);
							}
						});
					});
				} else {
					// this is a bad solution right now
					// we need another column in WorkSessions to be `live`, which is different from `open` (`open` is for cronjob reminder, `done` is for when user explicitly ends the session.)
					if (message.text == `done` || message.text == `Done`) {
						controller.trigger('end_session', [bot, { SlackUserId }]);
					} else {
						bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
							convo.say(`I'm not sure what you mean :thinking_face:. If you're finished with a session, reply \`done\``);
							convo.next();
						});
					}
				}
			});

		}, 1250);

			
	});

	/**
	 * 			~~ START OF SESSION_TIMER FUNCTIONALITIES ~~
	 */


	// session timer is up AND IN CONVO.ASK FLOW!
	controller.on('session_timer_up', (bot, config) => {

		/**
		 * 		Timer is up. Give user option to extend session or start reflection
		 */

		const { SlackUserId, workSession } = config;
		var dailyTaskIds = workSession.DailyTasks.map((dailyTask) => {
			return dailyTask.id;
		});

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {
			user.getDailyTasks({
				where: [ `"DailyTask"."id" IN (?) AND "Task"."done" = ?`, dailyTaskIds, false ],
				include: [ models.Task ]
			})
			.then((dailyTasks) => {

				// cancel all old reminders
				user.getReminders({
					where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break", "done_session_snooze"] ]
				}).
				then((oldReminders) => {
					oldReminders.forEach((reminder) => {
						reminder.update({
							"open": false
						})
					});
				});

				var taskTextsToWorkOnArray = dailyTasks.map((dailyTask) => {
					var text = dailyTask.Task.dataValues.text;
					return text;
				});
				var tasksToWorkOnString = commaSeparateOutTaskArray(taskTextsToWorkOnArray);

				// making this just a reminder now so that user can end his own session as he pleases
				bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

					convo.doneSessionTimerObject = {
						SlackUserId,
						sessionTimerDecision: false,
						dailyTaskIds
					}

					const { SlackUser: { tz } } = user;

					convo.sessionEnd = {
						UserId: user.id,
						tz,
						postSessionDecision: false,
						reminders: [],
						tasksCompleted: [],
						SlackUserId
					}

					var timeOutMinutes = 1000 * 60 * MINUTES_FOR_DONE_SESSION_TIMEOUT;

					setTimeout(() => {
						convo.doneSessionTimerObject.timeOut = true;
						convo.stop();
					}, timeOutMinutes);

					var message = ``;
					if (dailyTasks.length == 0) {
						message = `Hey, did you finish your tasks for this session?`;
					} else {
						message = `Hey, did you finish ${tasksToWorkOnString}?`
					}

					convo.ask({
						text: message,
						attachments:[
							{
								attachment_type: 'default',
								callback_id: "DONE_SESSION",
								fallback: "I was unable to process your decision",
								actions: [
									{
											name: buttonValues.doneSessionYes.name,
											text: "Yes! :punch:",
											value: buttonValues.doneSessionYes.value,
											type: "button",
											style: "primary"
									},
									{
											name: buttonValues.doneSessionSnooze.name,
											text: "Snooze :timer_clock:",
											value: buttonValues.doneSessionSnooze.value,
											type: "button"
									},
									{
											name: buttonValues.doneSessionDidSomethingElse.name,
											text: "Did something else",
											value: buttonValues.doneSessionDidSomethingElse.value,
											type: "button"
									},
									{
											name: buttonValues.doneSessionNo.name,
											text: "Nope",
											value: buttonValues.doneSessionNo.value,
											type: "button"
									}
								]
							}
						]
					},
					[
						{
							pattern: buttonValues.doneSessionYes.value,
							callback: function(response, convo) {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.didTask;
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{ // same as buttonValues.doneSessionYes.value
							pattern: utterances.yes,
							callback: (response, convo) => {
								convo.say("Great work :raised_hands:");
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.didTask;
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{
							pattern: buttonValues.doneSessionSnooze.value,
							callback: (response, convo) => {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.snooze;
								convo.next();
							}
						},
						{ // same as buttonValues.doneSessionSnooze.value
							pattern: utterances.containsSnooze,
							callback: (response, convo) => {
								convo.say(`Keep at it!`);
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.snooze;
								
								// wit will pick up duration here
								const { text, intentObject: { entities: { duration } } } = response;
								convo.doneSessionTimerObject.customSnooze = {
									text,
									duration
								};

								convo.next();
							}
						},
						{ // this just triggers `end_session` flow
							pattern: buttonValues.doneSessionDidSomethingElse.value,
							callback: (response, convo) => {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.didSomethingElse;
								convo.next();
							}
						},
						{ // same as buttonValues.doneSessionDidSomethingElse.value
							pattern: utterances.containsElse,
							callback: (response, convo) => {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.didSomethingElse;
								convo.say(`:ocean: Woo!`);
								convo.next();
							}
						},
						{
							pattern: buttonValues.doneSessionNo.value,
							callback: (response, convo) => {
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.noTasks;
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{ // same as buttonValues.doneSessionNo.value
							pattern: utterances.no,
							callback: (response, convo) => {
								convo.say(`That's okay! You can keep chipping away and you'll get there :pick:`);
								convo.doneSessionTimerObject.sessionTimerDecision = sessionTimerDecisions.noTasks;
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{ // this is failure point. restart with question
							default: true,
							callback: function(response, convo) {
								convo.say("I didn't quite get that :thinking_face:");
								convo.repeat();
								convo.next();
							}
						}
					]);
					convo.next();

					convo.on('end', (convo) => {

						const { sessionEnd: { postSessionDecision, reminders }, doneSessionTimerObject: { dailyTaskIds, timeOut, SlackUserId, sessionTimerDecision, customSnooze } } = convo;

						models.User.find({
							where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
							include: [
								models.SlackUser
							]
						})
						.then((user) => {

							if (timeOut) {

								// this "timeout" message only gets sent if this specific convo still has an open work session and no snooze attached. this means that user has gone AFK. if there is a snooze, another `done_session_timer` will trigger in 9 minutes and will be handle the ending of the work session
								
								// open sessions that were ENDED < 29.5 minutes ago
								var minutes = MINUTES_FOR_DONE_SESSION_TIMEOUT - 0.5;
								var timeOutMinutesAgo = moment().subtract(minutes, 'minutes').format("YYYY-MM-DD HH:mm:ss Z");
								user.getWorkSessions({
									where: [`"WorkSession"."open" = ? AND "WorkSession"."endTime" < ?`, true, timeOutMinutesAgo],
									order: `"WorkSession"."createdAt" DESC`
								})
								.then((workSessions) => {
									// only if there are still "open" work sessions
									if (workSessions.length > 0) {

										// also, if they did not snooze within the last 30 minutes
										var mostRecentOpenWorkSession = workSessions[0];
										user.getReminders({
											where: [`"Reminder"."type" = ? AND "Reminder"."createdAt" > ?`, "done_session_snooze", mostRecentOpenWorkSession.dataValues.createdAt]
										})
										.then((reminders) => {
											
											if (reminders.length == 0) {
												var { sentMessages } = bot;
												if (sentMessages) {
													// lastMessage is the one just asked by `convo`
													// in this case, it is `taskListMessage`
													var lastMessage = sentMessages.slice(-1)[0];
													if (lastMessage) {
														const { channel, ts } = lastMessage;
														var doneSessionMessageObject = {
															channel,
															ts
														};
														bot.api.chat.delete(doneSessionMessageObject);
													}
												}

												// this was a 30 minute timeout for done_session timer!
												controller.trigger(`done_session_timeout_flow`, [ bot, { SlackUserId, workSession }])
											}

										});
									};
								});
							} else {

								convo.doneSessionTimerObject.timeOut = false;

								// NORMAL FLOW
								const UserId = user.id;

								switch (sessionTimerDecision) {
									case sessionTimerDecisions.didTask:
										// update the specific task finished
										user.getDailyTasks({
											where: [ `"DailyTask"."id" IN (?)`, dailyTaskIds ],
											include: [ models.Task ]
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
										});
										break;
									case sessionTimerDecisions.snooze:

										if (customSnooze) {

											const { text, duration } = customSnooze;

											// user only said `snooze`
											if (utterances.onlyContainsSnooze.test(text)) {
												// automatically do default snooze here then
												controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId }]);
											} else {
												// user said `snooze for X minutes`
												controller.trigger(`snooze_reminder_flow`, [ bot, { SlackUserId, duration } ]);
											}

										} else {
											// button triggered it (do default)
											controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId }]);
										}
											
										return;
									case sessionTimerDecisions.didSomethingElse:
										controller.trigger(`end_session`, [ bot, { SlackUserId }])
										return;
									case sessionTimerDecisions.noTasks:
										// nothing
										break;
									default: break;
								}

								/**
								 * 		~~ THIS IS SIMULATION OF `session_end` FLOW
								 * 		essentially figuring out postSessionDecision
								 */
								
								// end all OPEN work sessions here, because user
								// ~~ CLOSING a work session MUST ALSO MAKE IT NOT LIVE!! ~~
								// has decided to PROACTIVELY CLOSE IT
								user.getWorkSessions({
									where: [ `"WorkSession"."open" = ?`, true ],
									order: `"createdAt" DESC`
								})
								.then((workSessions) => {
									workSessions.forEach((workSession) => {
										workSession.update({
											open: false,
											live: false
										});
									});

									// then from here, active the postSessionDecisions
									setTimeout(() => { 
										handlePostSessionDecision(postSessionDecision, { controller, bot, SlackUserId });
									}, 500);
								});

								// set reminders (usually a break)
								reminders.forEach((reminder) => {
									const { remindTime, customNote, type } = reminder;
									models.Reminder.create({
										UserId,
										remindTime,
										customNote,
										type
									});
								});

							};
						});
					});
				});
			});
		})
	});

	/**
	 * 			~~ START OF END_SESSION FLOW FUNCTIONALITIES ~~
	 */

	// the actual end_session flow
	controller.on('end_session', (bot, config) => {

		/**
		 * 		User has agreed for session to end at this point
		 */

		const { SlackUserId, botCallback } = config;
		if (botCallback) {
			// if botCallback, need to get the correct bot
			var botToken = bot.config.token;
			bot          = bots[botToken];
		}

		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

			// object that contains values important to this conversation
			convo.sessionEnd = {
				SlackUserId,
				postSessionDecision: false, // what is the user's decision? (break, another session, etc.)
				reminders: [], // there will be lots of potential reminders
				tasksCompleted: []
			};

			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {

				// need user's timezone for this flow!
				const { SlackUser: { tz } } = user;
				if (!tz) {
					bot.startPrivateConversation({ user: SlackUserId }, (err,convo) => {
						convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
					});
					return;
				}

				convo.sessionEnd.UserId = user.id;
				convo.sessionEnd.tz     = tz;

				closeOldRemindersAndSessions(user);

				return user.getDailyTasks({
					where: [ `"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live" ],
					order: `"DailyTask"."priority" ASC`,
					include: [ models.Task ]
				});
			})
			.then((dailyTasks) => {

				var taskArray              = convertToSingleTaskObjectArray(dailyTasks, "daily");
				convo.sessionEnd.taskArray = taskArray;
				var taskListMessage        = convertArrayToTaskListMessage(taskArray);

				if (taskArray.length == 0) {
					convo.say("You don't have any tasks on today's list! Great work :punch:");
					convo.sessionEnd.hasNoTasksToWorkOn = true;
					askUserPostSessionOptions(err, convo);
					convo.next();
				} else {
					convo.say("Which task(s) did you get done? `i.e. tasks 1, 2`");
					convo.ask({
						text: `${taskListMessage}`,
						attachments:[
							{
								attachment_type: 'default',
								callback_id: "FINISH_TASKS_ON_END_SESSION",
								fallback: "I was unable to process your decision",
								color: colorsHash.grey.hex,
								actions: [
									{
										name: buttonValues.differentTask.name,
										text: "Something Else",
										value: buttonValues.differentTask.value,
										type: "button"
									},
									{
										name: buttonValues.noTasks.name,
										text: "None yet!",
										value: buttonValues.noTasks.value,
										type: "button"
									}
								]
							}
						]
					},[
						{
							pattern: buttonValues.noTasks.value,
							callback: (response, convo) => {
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{ // same as clicking buttonValues.noTasks.value
							pattern: utterances.containsNone,
							callback: (response, convo) => {
								convo.say("No worries! :smile_cat:");
								askUserPostSessionOptions(response, convo);
								convo.next();
							}
						},
						{
							pattern: buttonValues.differentTask.value,
							callback: (response, convo) => {
								askForDifferentCompletedTask(response, convo);
								convo.next();
							}
						},
						{ // same as clicking buttonValues.differentTask.value
							pattern: utterances.containsDifferent,
							callback: (response, convo) => {
								convo.say("What did you get done instead?")
								askForDifferentCompletedTask(response, convo);
								convo.next();
							}
						},
						{ // user has listed task numbers here
							default: true,
							callback: (response, convo) => {

								// user inputed task #'s (`2,4,1`), not new task button
								var { intentObject: { entities } } = response;
								var tasksCompletedString = response.text;

								var taskNumberCompletedArray = convertTaskNumberStringToArray(tasksCompletedString, taskArray);

  							// repeat convo if invalid w/ informative context
							  if (taskNumberCompletedArray) {
							    
							    // get the actual ids
									var tasksCompletedArray = [];
									taskNumberCompletedArray.forEach((taskNumber) => {
										var index = taskNumber - 1; // to make 0-index based
										if (taskArray[index])
											tasksCompletedArray.push(taskArray[index].dataValues.id);
									});

									convo.sessionEnd.tasksCompleted = tasksCompletedArray;
									convo.say("Great work :punch:");
									askUserPostSessionOptions(response, convo);

							  } else {

							  	convo.say("Oops, I don't totally understand :dog:. Let's try this again");
							    convo.say("You can pick a task from your list `i.e. tasks 1, 3` or say `none`");
							    convo.repeat();

							  }
							  convo.next();
							}
						}
					]);
				}
			});

			convo.on('end', (convo) => {
				console.log("SESSION END!!!");

				var responses = convo.extractResponses();
				var {sessionEnd } = convo;

				if (convo.status == 'completed') {

					console.log("CONVO SESSION END: ");
					console.log(convo.sessionEnd);

					// went according to plan
					const { SlackUserId, UserId, postSessionDecision, reminders, tasksCompleted, taskArray, differentCompletedTask, tz } = convo.sessionEnd;

					// end all live sessions and reminder checkins (type `work_session`) the user might have
					models.User.find({
						where: [`"User"."id" = ?`, UserId ],
						include: [ models.SlackUser ]
					})
					.then((user) => {

						/**
						 * 		~~ END OF WORK SESSION ~~
						 * 			1. cancel all `break` and `checkin` reminders
						 * 			2. mark said `tasks` as done
						 * 			3. handle postSession decision (set `break` reminder, start new session, etc.)
						 * 			4. close all live worksessions
						 * 			5. if completed diff task, store that for user
						 */

						// cancel all checkin reminders (type: `work_session` or `break`)

						// set reminders (usually a break)
						reminders.forEach((reminder) => {
							const { remindTime, customNote, type } = reminder;
							models.Reminder.create({
								UserId,
								remindTime,
								customNote,
								type
							});
						});

						// mark appropriate tasks as done
						tasksCompleted.forEach((TaskId) => {
							models.DailyTask.find({
								where: { id: TaskId },
								include: [ models.Task] 
							})
							.then((dailyTask) => {
								if (dailyTask) {
									dailyTask.Task.updateAttributes({
										done: true
									})
								}
							})
						});

						
						// get the most recent work session
						// to handle if user got new task done
						user.getWorkSessions({
							limit: 1,
							order: `"createdAt" DESC`
						})
						.then((workSessions) => {

							var endTime = moment();
							// IF you chose a new task not on your list to have completed
							if (differentCompletedTask) {

								var minutes; // calculate time worked on that task
								if (workSessions.length > 0) {

									// use this to get how long the
									// custom added task took
									var startSession = workSessions[0];
									var startTime    = moment(startSession.startTime);
									minutes          = moment.duration(endTime.diff(startTime)).asMinutes();

								} else {
									// this should never happen.
									minutes = 30; // but if it does... default minutes duration
								}

								// create new task that the user just got done
								user.getDailyTasks({
									where: [ `"DailyTask"."type" = ?`, "live" ]
								})
								.then((dailyTasks) => {
									const priority = dailyTasks.length+1;
									const text     = differentCompletedTask;
									// record the different completed task
									models.Task.create({
										text,
										done: true
									})
									.then((task) => {
										const TaskId = task.id;
										models.DailyTask.create({
											TaskId,
											priority,
											minutes,
											UserId
										})
									})
								});
							}

							setTimeout(() => { 
								handlePostSessionDecision(postSessionDecision, { controller, bot, SlackUserId });
							}, 500);

						});

					});
				

				} else {
					// FIX POTENTIAL PITFALLS HERE
					if (!sessionEnd.postSessionDecision) {
						convo.say("I'm not sure went wrong here :dog: Please let my owners know");
					}
				}
			});

		});

	});

};

// ask user for options after finishing session
export function askUserPostSessionOptions(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	
	// only if first time!
	// convo.say("I recommend taking a 15 minute break after about 90 minutes of focused work to keep your mind and attention fresh :tangerine:");
	// convo.say("Breaks are great times to read books and articles, or take a walk outside to get some fresh air :books: :walking:");
	convo.ask({
    text: `Would you like to take a break now, or start a new session?`,
    attachments:[
      {
        attachment_type: 'default',
        callback_id: "END_SESSION",
        color: colorsHash.turquoise.hex,
        fallback: "I was unable to process your decision",
        actions: [
          {
              name: buttonValues.takeBreak.name,
              text: "Take a break",
              value: buttonValues.takeBreak.value,
              type: "button"
          },
          {
              name: buttonValues.startSession.name,
              text: "Another session :muscle:",
              value: buttonValues.startSession.value,
              type: "button"
          },
          {
              name: buttonValues.backLater.name,
              text: "Be Back Later",
              value: buttonValues.backLater.value,
              type: "button"
          },
          {
              name: buttonValues.endDay.name,
              text: "End my day :sleeping:",
              value: buttonValues.endDay.value,
              type: "button",
              style: "danger"
          }
        ]
      }
    ]
  },
  [
    {
      pattern: buttonValues.takeBreak.value,
      callback: function(response, convo) {      	
      	getBreakTime(response, convo);
        convo.next();
      }
    },
    { // NL equivalent to buttonValues.takeBreak.value
      pattern: utterances.containsBreak,
      callback: function(response, convo) {
      	console.log(utterances.containsBreak);
        getBreakTime(response, convo);
        convo.next();
      }
    },
    {
      pattern: buttonValues.startSession.value,
      callback: function(response, convo) {
        convo.sessionEnd.postSessionDecision = intentConfig.START_SESSION;
        convo.next();
      }
    },
    { // NL equivalent to buttonValues.startSession.value
      pattern: utterances.startSession,
      callback: function(response, convo) {
      	convo.sessionEnd.postSessionDecision = intentConfig.START_SESSION;
        convo.next();
      }
    },
    {
      pattern: buttonValues.endDay.value,
      callback: function(response, convo) {
        convo.sessionEnd.postSessionDecision = intentConfig.END_DAY;
        convo.next();
      }
    },
    { // NL equivalent to buttonValues.endDay.value
      pattern: utterances.containsEnd,
      callback: function(response, convo) {
        convo.sessionEnd.postSessionDecision = intentConfig.END_DAY;
        convo.next();
      }
    },
    {
      pattern: buttonValues.backLater.value,
      callback: function(response, convo) {
      	handleBeBackLater(response, convo)
        convo.next();
      }
    },
    { // NL equivalent to buttonValues.backLater.value
      pattern: utterances.containsBackLater,
      callback: function(response, convo) {
      	convo.say("Okay! I'll be here when you get back");
      	handleBeBackLater(response, convo)
        convo.next();
      }
    },
    { // this is failure point. restart with question
      default: true,
      callback: function(response, convo) {
        convo.say("I didn't quite get that :dog:. Let's choose an option from the buttons for now");
        convo.repeat();
        convo.next();
      }
    }
  ]);
	
}

// user has completed a different task and we'll take note
function askForDifferentCompletedTask(response, convo) {
	convo.ask("I'll add it as a completed task for you :memo:", (response, convo) => {
		convo.sessionEnd.differentCompletedTask = response.text;
		convo.say("Noted!");
		askUserPostSessionOptions(response, convo);
		convo.next();
	})
}

// simple way to handle be back later
function handleBeBackLater(response, convo) {
	convo.say("You can also ask for me to check in with you at a specific time later :grin:");
}

// handle break time
// if button click: ask for time, recommend 15 min
// if NL break w/ no time: ask for time, recommend 15 min
// if NL break w/ time: streamline break w/ time
function getBreakTime(response, convo) {

	var { intentObject: { entities } } = response;
	const { sessionEnd: { tz } }       = convo;

	convo.sessionEnd.postSessionDecision = intentConfig.WANT_BREAK; // user wants a break!

	var durationSeconds = 0;
	if (entities.duration) {
		var durationArray = entities.duration;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);
		convo.sessionEnd.breakDuration = durationMinutes;
		
		// calculate break time and add reminder
		var customTimeObject =  moment().tz(tz).add(durationMinutes, 'minutes');
		var customTimeString = customTimeObject.format("h:mm a");

		convo.say(`Great! I'll check in with you in ${durationMinutes} minutes at *${customTimeString}* :smile:`);
		convo.sessionEnd.reminders.push({
			customNote: `It's been ${durationMinutes} minutes. Let me know when you're ready to start a session`,
			remindTime: customTimeObject,
			type: "break"
		});
	} else {

		convo.ask("How long do you want to take a break? I recommend 15 minutes for every 90 minutes of work :grin:", (response, convo) => {

			var timeToTask = response.text;

	    var validMinutesTester = new RegExp(/[\dh]/);
	    var isInvalid = false;
	    if (!validMinutesTester.test(timeToTask)) {
	      isInvalid = true;
	    }

			// INVALID tester
	    if (isInvalid) {
	      convo.say("Oops, looks like you didn't put in valid minutes :thinking_face:. Let's try this again");
	      convo.say("I'll assume you mean minutes - like `30` would be 30 minutes - unless you specify hours - like `1 hour 15 min`");
	      convo.repeat();
	    } else {

				var durationMinutes  = convertTimeStringToMinutes(timeToTask);
				var customTimeObject = moment().tz(tz).add(durationMinutes, 'minutes');
				var customTimeString = customTimeObject.format("h:mm a");

	      convo.sessionEnd.breakDuration = durationMinutes;

				convo.say(`Great! I'll check in with you in ${durationMinutes} minutes at *${customTimeString}* :smile:`);

				// calculate break time and add reminder
				convo.sessionEnd.reminders.push({
					customNote: `It's been ${durationMinutes} minutes. Let me know when you're ready to start a session`,
					remindTime: customTimeObject,
					type: "break"
				});

	    }
	    convo.next();
	  });
	}

}

// NEED ALL 3 FOR CONFIG: SlackUserId, controller, bot
export function handlePostSessionDecision(postSessionDecision, config) {

	const { SlackUserId, controller, bot } = config;

	switch (postSessionDecision) {
		case intentConfig.WANT_BREAK:
			break;
		case intentConfig.END_DAY:
			controller.trigger('trigger_day_end', [bot, { SlackUserId }]);
			break;
		case intentConfig.START_SESSION:
			controller.trigger('confirm_new_session', [bot, { SlackUserId }]);
			break;
		default: break;
	}
}