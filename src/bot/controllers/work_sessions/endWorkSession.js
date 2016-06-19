import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

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
								pattern: bot.utterances.yes,
								callback: (response, convo) => {
									convo.finishedWithSession = true;
									convo.next();
								}
							},
							{
								pattern: bot.utterances.no,
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

				// temporary fix to get tasks
				var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");
				return user.getDailyTasks({
					where: [ `"Task"."done" = ? AND "DailyTask"."createdAt" > ? AND "DailyTask"."type" = ?`, false, timeAgoForTasks, "live" ],
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
					taskListMessage = "Say `next` to keep going";
				} else {
					convo.say("Which task(s) did you get done? Just write which number(s) `i.e. 1, 2`");
				}

				convo.ask(taskListMessage, (response, convo) => {

					/**
					 * 		4 possible responses:
					 * 			1. write numbers down
					 * 			2. says "didn't get one done"
					 * 			3. "was distracted"
					 * 			4. "did something else"
					 * 			will only deal with the top 2 for now
					 */
					
					var { intentObject: { entities } } = response;
					var tasksCompleted = response.text;

					var tasksCompletedSplitArray = tasksCompleted.split(/(,|and)/);

					// IF THE USER HAS NO TASKS ON DAILY TASK LIST
					if (convo.sessionEnd.hasNoTasksToWorkOn) {
						askUserPostSessionOptions(response, convo);
						convo.next();
						return;
					}

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

					if (taskNumberCompletedArray.length == 0) {
						// no tasks completed
						convo.say("No worries! :smile_cat:");
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

					askUserPostSessionOptions(response, convo);
					convo.next();
					
				});
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

function askUserPostSessionOptions(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;
	
	convo.say("I recommend taking a 15 minute break after about 90 minutes of focused work to keep your mind and attention fresh :tangerine:");
	convo.say("Breaks are great times to read books and articles, or take a walk outside to get some fresh air :books: :walking:");
	convo.ask("Would you like to take a break now, or start a new session?", (response, convo) => {

		/**
		 * 		Does user want a break?
		 * 		possible answers:
		 * 			- break [intent `want_break`]
		 * 			- new session [intent `start_session`]
		 * 			- leaving for a bit
		 * 			- done for the day [intent `end_day`]
		 */
		
		var { intentObject: { entities } } = response;
		var { intent }                     = entities;
		var intentValue                    = (intent && intent[0]) ? intent[0].value : null;
		var responseMessage                = response.text;

		console.log("responseMessage: "+responseMessage);

		if (intentValue && (intentValue == intentConfig.WANT_BREAK || intentValue == intentConfig.START_SESSION || intentValue == intentConfig.END_DAY)) {
			console.log("in here?? wtf");
			// there is an intent
			switch (intentValue) {
				case intentConfig.WANT_BREAK:
					
					convo.sessionEnd.postSessionDecision = intentConfig.WANT_BREAK;

					// calculate break duration through wit
					var durationSeconds = 0;
					if (entities.break_duration) {
						var durationArray = entities.break_duration;
						for (var i = 0; i < durationArray.length; i++) {
							durationSeconds += durationArray[i].normalized.value;
						}
					} else if (entities.duration) {
						var durationArray = entities.duration;
						for (var i = 0; i < durationArray.length; i++) {
							durationSeconds += durationArray[i].normalized.value;
						}
					} else {
						durationSeconds = 15 * 60; // default to 15 min break
					}
					var durationMinutes = Math.floor(durationSeconds / 60);

					convo.sessionEnd.breakDuration = durationMinutes;
					
					convo.say(`Great! I'll check in with you in ${durationMinutes} minutes :smile:`);
					convo.sessionEnd.postSessionDecision = intentConfig.WANT_BREAK;

					// calculate break time and add reminder
					var checkinTimeStamp =  moment().add(durationMinutes, 'minutes').format("YYYY-MM-DD HH:mm:ss");
					convo.sessionEnd.reminders.push({
						customNote: `It's been ${durationMinutes} minutes. Let me know when you're ready to start a session`,
						remindTime: checkinTimeStamp,
						type: "break"
					});
					break;
				case intentConfig.START_SESSION:
					convo.sessionEnd.postSessionDecision = intentConfig.START_SESSION;
					break;
				case intentConfig.END_DAY:
					convo.sessionEnd.postSessionDecision = intentConfig.END_DAY;
					break;
				default:
					break;
			}
		} else if (responseMessage == "be back later") {
			console.log("in here as you should be wtf\n\n\n\n");
			convo.say("I'll be here when you get back!");
			convo.say("You can also ask for me to check in with you at a specific time later :grin:"); // if user wants reminder, simply input a reminder outside of this convo
		} else {
			// let's encourage an intent
			convo.say("Sorry I didn't get that :dog:. Let me know if you want to `take a break` or `start another session`. If you're leaving for a bit, just say `be back later`");
			convo.repeat();
		}

		convo.next();
	});
	convo.next();
}

