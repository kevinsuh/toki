import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt, utterances } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

import { colorsArray, buttonValues, colorsHash } from '../../lib/constants';

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
				// if open work session, confirm end early
				// else, user MUST say `done` to trigger end (this properly simulates user is done with that session)
				if (workSessions.length > 0) {
					bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
						convo.ask(`Are you finished with your session?`, [
							{
								pattern: utterances.yes,
								callback: (response, convo) => {
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
					if (message.text == `done`) {
						controller.trigger('end_session', [bot, { SlackUserId }]);
					} else {
						bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
							convo.say(`I'm not absolutely sure what you mean :thinking_face:. If you're finished with a session, reply \`done\``);
							convo.next();
						});
					}
				}
			});

		}, 1250);

			
	});

	// session timer is up
	controller.on('session_timer_up', (bot, config) => {

		/**
		 * 		Timer is up. Give user option to extend session or start reflection
		 */

		const { SlackUserId } = config;

		// making this just a reminder now so that user can end his own session as he pleases
		bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {

			convo.say(`:timer_clock: time's up. Reply \`done\` when you're ready to end the session`);
			convo.next();
			
		});

	});

	// the actual end_session flow
	controller.on('end_session', (bot, config) => {

		/**
		 * 		User has agreed for session to end at this point
		 */

		const { SlackUserId } = config;

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

				convo.sessionEnd.UserId = user.id;

				return user.getDailyTasks({
					where: [ `"Task"."done" = ? AND "DailyTask"."type" = ?`, false, "live" ],
					order: `"DailyTask"."priority" ASC`,
					include: [ models.Task ]
				});
			})
			.then((dailyTasks) => {

				var taskArray              = convertToSingleTaskObjectArray(dailyTasks, "daily");
				convo.sessionEnd.taskArray = taskArray;
				var taskListMessage        = convertArrayToTaskListMessage(taskArray, { noKarets: true });

				if (taskArray.length == 0) {
					convo.say("You don't have any tasks on today's list! Great work :punch:");
					convo.sessionEnd.hasNoTasksToWorkOn = true;
					askUserPostSessionOptions(err, convo);
					convo.next();
				} else {
					convo.say("Which task(s) did you get done? `i.e. tasks 1, 2`");
					convo.ask({
						attachments:[
							{
								text: taskListMessage,
								attachment_type: 'default',
								callback_id: "FINISH_TASKS_ON_END_SESSION",
								fallback: "I was unable to process your decision",
								actions: [
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
							default: true,
							callback: (response, convo) => {
								// user inputed task #'s, not new task button
								var { intentObject: { entities } } = response;
								var tasksCompleted = response.text;
								var tasksCompletedSplitArray = tasksCompleted.split(/(,|and)/);

								// if we capture 0 valid tasks from string, then we start over
								var numberRegEx              = new RegExp(/[\d]+/);
								var taskNumberCompletedArray = [];
								tasksCompletedSplitArray.forEach((taskString) => {
									console.log(`task string: ${taskString}`);
									var taskNumber = taskString.match(numberRegEx);
									if (taskNumber) {
										taskNumber = parseInt(taskNumber[0]);
										if (taskNumber <= taskArray.length) {
											taskNumberCompletedArray.push(taskNumber);
										}
									}
								});

								// invalid if we captured no tasks
  							var isInvalid = (taskNumberCompletedArray.length == 0 ? true : false);
  							// repeat convo if invalid w/ informative context
							  if (isInvalid) {
							    convo.say("Oops, I don't totally understand :dog:. Let's try this again");
							    convo.say("You can pick a task from your list `i.e. tasks 1, 3` or say `none`");
							    convo.repeat();
							  } else {
							  	// get the actual ids
									var tasksCompletedArray = [];
									taskNumberCompletedArray.forEach((taskNumber) => {
										var index = taskNumber - 1; // to make 0-index based
										if (taskArray[index])
											tasksCompletedArray.push(taskArray[index].dataValues.id);
									});

									convo.sessionEnd.tasksCompleted = tasksCompletedArray;
									convo.say("Great work :punch:");
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
					const { SlackUserId, UserId, postSessionDecision, reminders, tasksCompleted, taskArray } = convo.sessionEnd;

					// end all open sessions and reminder checkins (type `work_session`) the user might have
					models.User.find({
						where: [`"User"."id" = ?`, UserId ],
						include: [ models.SlackUser ]
					})
					.then((user) => {

						/**
						 * 		~~ END OF WORK SESSION ~~
						 * 			1. cancel all `break` and `checkin` reminders
						 * 			2. mark said `tasks` as done
						 * 			3. set new `reminders` (i.e break)
						 * 			4. close open worksessions and start new one if requested
						 */

						// cancel all checkin reminders (type: `work_session` or `break`)
						// AFTER this is done, put in new break
						user.getReminders({
							where: [ `"open" = ? AND "type" IN (?)`, true, ["work_session", "break"] ]
						}).
						then((oldReminders) => {
							oldReminders.forEach((reminder) => {
								reminder.update({
									"open": false
								})
							});
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

						// mark appropriate tasks as done
						taskArray.forEach((task) => {
							if (tasksCompleted.indexOf(task.dataValues.id) > -1) {
								// get daily tasks
								models.DailyTask.find({
									where: { id: task.dataValues.id },
									include: [ models.Task] 
								})
								.then((dailyTask) => {
									if (dailyTask) {
										dailyTask.Task.updateAttributes({
											done: true
										})
									}
								})
							}
						});

						// end all open work sessions
						// make decision afterwards (to ensure you have no sessions open if u want to start a new one)
						user.getWorkSessions({
							where: [ `"open" = ?`, true ]
						})
						.then((workSessions) => {
							var endTime = moment().format("YYYY-MM-DD HH:mm:ss");
							workSessions.forEach((workSession) => {
								workSession.update({
									endTime,
									"open": false
								});
							});

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

						});

					});
				

				} else {
					// ending convo prematurely
					console.log("ending convo early: \n\n\n\n");
					console.log("controller:");
					console.log(controller);
					console.log("\n\n\n\n\nbot:");
					console.log(bot);

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
function askUserPostSessionOptions(response, convo) {

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
      	handleBeBackLater(response, convo)
        convo.next();
      }
    },
    { // this is failure point. restart with question
      default: true,
      callback: function(response, convo) {
        convo.say("I didn't quite get that :dog:. Let me know if you want to `take a break` or `start another session`. If you're leaving for a bit, just say `be back later`");
        convo.repeat();
        convo.next();
      }
    }
  ]);
	
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
	convo.sessionEnd.postSessionDecision = intentConfig.WANT_BREAK; // user wants a break!

	var durationSeconds = 0;
	if (entities.duration) {
		var durationArray = entities.duration;
		for (var i = 0; i < durationArray.length; i++) {
			durationSeconds += durationArray[i].normalized.value;
		}
		var durationMinutes = Math.floor(durationSeconds / 60);
		convo.sessionEnd.breakDuration = durationMinutes;
		convo.say(`Great! I'll check in with you in ${durationMinutes} minutes :smile:`);
		// calculate break time and add reminder
		var checkinTimeStamp =  moment().add(durationMinutes, 'minutes').format("YYYY-MM-DD HH:mm:ss");
		convo.sessionEnd.reminders.push({
			customNote: `It's been ${durationMinutes} minutes. Let me know when you're ready to start a session`,
			remindTime: checkinTimeStamp,
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
				var customTimeObject = moment().add(durationMinutes, 'minutes');
				var customTimeString = customTimeObject.format("h:mm a");

	      convo.sessionEnd.breakDuration = durationMinutes;
				convo.say(`Great! I'll check in with you in ${durationMinutes} minutes :smile:`);
				// calculate break time and add reminder
				var checkinTimeStamp =  moment().add(durationMinutes, 'minutes').format("YYYY-MM-DD HH:mm:ss");
				convo.sessionEnd.reminders.push({
					customNote: `It's been ${durationMinutes} minutes. Let me know when you're ready to start a session`,
					remindTime: checkinTimeStamp,
					type: "break"
				});

	    }
	    convo.next();
	  });
	}

}

