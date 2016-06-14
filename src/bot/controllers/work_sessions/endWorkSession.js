import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

const intentConfig =  {
	WANT_BREAK: 'want_break',
	START_SESSION: 'start_session',
	END_DAY: 'end_day'
}

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
			if (workSessions.length > 0) {
				// has open work sessions
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
				})
			} else {
				// no open sessions
				bot.send({
					type: "typing",
					channel: message.channel
				});
				setTimeout(()=>{
					bot.reply(message, "You don't have any open sessions right now :thinking_face:. Let me know when you want to `start a session`");
				}, randomInt(1250, 1750));
			}
		});
	});

	// session timer is up
	controller.on('session_timer_up', (bot, config) => {

		/**
		 * 		Timer is up. Give user option to extend session or start reflection
		 */

		const { SlackUserId } = config;

		// has open work sessions
		bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
			convo.ask(`:timer_clock: time's up. Reply \`done\` when you're ready to end the session`, (response, convo) => {

				var responseMessage = response.text;
				var { intentObject: { entities } } = response;
				var done = new RegExp(/[d]/);

				if (entities.duration || entities.custom_time) {
					convo.say("Got it, you want more time :D");
					// addSnoozeToSession(response, convo)
				} else if (done.test(responseMessage)) {
					convo.finishedWithSession = true;
				} else {
					// invalid
					convo.say("I'm sorry, I didn't catch that :dog:");
					convo.repeat();
				}

				convo.next();

			});
			convo.on('end', (convo) => {
				if (convo.finishedWithSession) {
					controller.trigger('end_session', [bot, { SlackUserId }]);
				}
			});
		})

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
				postSessionDecision: false // what is the user's decision? (break, another session, etc.)
				reminders: [] // there will be lots of potential reminders
			};

			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {
				// temporary fix to get tasks
				var timeAgoForTasks = moment().subtract(14, 'hours').format("YYYY-MM-DD HH:mm:ss");
				return user.getTasks({
					where: [ `"Task"."done" = ? AND "DailyTasks"."createdAt" > ?`, false, timeAgoForTasks ],
					order: `"DailyTasks"."priority" ASC`,
					include: [ models.DailyTask ]
				});
			})
			.then((tasks) => {

				var taskArray = convertToSingleTaskObjectArray(tasks, "task");
				var taskListMessage = convertArrayToTaskListMessage(taskArray);

				convo.say("Which task(s) did you get done? Just write which number(s) `i.e. 1, 2`");
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

					// if we capture 0 valid tasks from string, then we start over
					var numberRegEx = new RegExp(/[\d]+/);
					var tasksCompletedArray = [];
					tasksCompletedSplitArray.forEach((taskString) => {
						console.log(`task string: ${taskString}`);
						var taskNumber = taskString.match(numberRegEx);
						if (taskNumber) {
							taskNumber = parseInt(taskNumber[0]);
							if (taskNumber <= taskArray.length) {
								tasksCompletedArray.push(taskNumber);
							}
						}
					});

					if (tasksCompletedArray.length == 0) {
						// no tasks completed
						convo.say("That's okay! You can keep chipping away and you'll get there :pick:");
					} else {
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

					// went according to plan
					const { SlackUserId, postSessionDecision, reminders } = convo.sessionEnd;

					// not much to do here other than set potential reminders
					switch (postSessionDecision) {
						case intentConfig.WANT_BREAK:
							// taking a break currently handled inside convo
							break;
						case intentConfig.END_DAY:
							convo.say("Let's review the day! :pencil:");
						case intentConfig.START_SESSION:
							convo.say(`Love your hustle :muscle:`);
							convo.say(`Let's do this :thumbsup:`);
						default: break;
					}
					console.log(convo.sessionEnd);

					
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
	
	convo.say("Would you like to take a break now, or start a new session?");
	convo.say("I recommend taking a 15 minute break after about 90 minutes of focused work to keep your mind and attention fresh :tangerine:");
	convo.ask("Breaks are great times to read books and articles, or take a walk outside to get some fresh air :books: :walking:", (response, convo) => {

		/**
		 * 		Does user want a break?
		 * 		possible answers:
		 * 			- break [intent `want_break`]
		 * 			- new session [intent `start_session`]
		 * 			- leaving for a bit
		 * 			- done for the day [intent `end_day`]
		 */
		
		var { intentObject: { entities } } = response;
		var { intents }                    = entities;
		var intent                         = intents[0] ? intents[0].value : null;
		var responseMessage                = response.text;

		if (intent) {
			// there is an intent
			switch (intent) {
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
					
					convo.say(`Great! I'll check in with you after your ${durationMinutes} break`);
					convo.sessionEnd.postSessionDecision = intentConfig.WANT_BREAK;

					// calculate break time and add reminder
					var checkinTimeStamp =  moment().add(durationMinutes, 'minutes').format("YYYY-MM-DD HH:mm:ss");
					convo.sessionEnd.reminders.push({
						customNote: `Hey! It's been ${durationMinutes} minutes. Let me know when you're ready to \`start a session\``,
						remindTime: checkinTimeStamp
					});

				case intentConfig.START_SESSION:
					convo.sessionEnd.postSessionDecision = intentConfig.START_SESSION;
				case intentConfig.END_DAY:
					convo.sessionEnd.postSessionDecision = intentConfig.END_DAY;
				default:
					break;
			}
		} else if (responseMessage == "be back later") {
			convo.say("I'll be here when you get back!");
			convo.say("You can also ask for me to check in with you at a specific time later :grin:"); // if user wants reminder, simply input a reminder outside of this convo
		} else {
			// let's encourage an intent
			convo.say("Sorry I didn't get that :dog:. Let me know if you want to `take a break` or `start another session`. If you're leaving for a bit, just say `be back later`");
		}

		convo.next();
	});
}

