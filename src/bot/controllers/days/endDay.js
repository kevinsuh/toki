import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import { closeOldRemindersAndSessions } from '../../lib/miscHelpers';
import intentConfig from '../../lib/intents';

import { resumeQueuedReachouts } from '../index';

// base controller for end day
export default function(controller) {

	// programmatic trigger of actual day start flow: `end_day_flow`
	controller.on('trigger_day_end', (bot, config) => {

		const { SlackUserId } = config;
		controller.trigger(`end_day_flow`, [ bot, { SlackUserId } ]);

	})

	/**
	 * 		User directly asks to end day
	 * 				~* via Wit *~
	 * 			confirm for `end_day_flow`
	 */
	controller.hears(['end_day'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{

			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {

				// ping to start a day if they have not yet
				user.getSessionGroups({
			    order: `"SessionGroup"."createdAt" DESC`,
			    limit: 1
		    })
		    .then((sessionGroups) => {

		      // should start day
		      var shouldStartDay = false;
		      if (sessionGroups.length == 0) {
		      	shouldStartDay = true;
		      } else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
		      	shouldStartDay = true;
		      }
		      if (shouldStartDay) {
		      	bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
							convo.say("You have not started a day yet! Let me know when you want to `start a day` together :smile:");
							convo.next();
						});
						return;
		      }

		      bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						var name              = user.nickName || user.email;
						convo.name            = name;
						convo.readyToEndDay = false;

						convo.ask(`Hey ${name}! Would you like to end your day?`, [
							{
								pattern: utterances.yes,
								callback: (response, convo) => {
									convo.readyToEndDay = true;
									convo.next();
								}
							},
							{
								pattern: utterances.no,
								callback: (response, convo) => {
									convo.say("Okay. I'm here whenever you're ready to end your day :wave:");
									convo.next();
								}
							},
							{
								default: true,
								callback: (response, convo) => {
									convo.say("Couldn't quite catch that. I'll be here when you're ready to `end your day` :wave:");
									convo.next();
								}
							}
						]);
						convo.on('end', (convo) => {
							if (convo.readyToEndDay) {
								closeOldRemindersAndSessions(user);
								controller.trigger(`end_day_flow`, [ bot, { SlackUserId }]);
							}
						})
					
					});

		    });

					
			});
		}, 1000);
	});

	/**
	* 	~ ACTUAL END OF YOUR DAY ~
	* 		* Show completed tasks
	* 		* Show total time of focused sessions
	* 		* Ask for reflection
	* 		* 
	* 		
	*/
	controller.on('end_day_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			// get the most recent start_work session group to measure
			// a day's worth of work
			user.getSessionGroups({
		    order: `"SessionGroup"."createdAt" DESC`,
		    limit: 1
	    })
	    .then((sessionGroups) => {

	      // should start day
	      var shouldStartDay = false;
	      if (sessionGroups.length == 0) {
	      	shouldStartDay = true;
	      } else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
	      	shouldStartDay = true;
	      }
	      if (shouldStartDay) {
	      	bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
						convo.say("You have not started a day yet! Let's `start a day` together :smile:");
						convo.next();
					});
					resumeQueuedReachouts(bot, { SlackUserId });
					return;
	      }
	      
				const startSessionGroup   = sessionGroups[0]; // the start day

	      user.getDailyTasks({
					where: [`"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?`, startSessionGroup.dataValues.createdAt, true, "live"],
					include: [ models.Task ],
					order: `"DailyTask"."priority" ASC`
				})
				.then((dailyTasks) => {

					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						var name   = user.nickName || user.email;
						convo.name = name;

						convo.dayEnd = {
							UserId: user.id,
							endDayDecision: false // what does user want to do with day
						}

						dailyTasks = convertToSingleTaskObjectArray(dailyTasks, "daily");
						convo.dayEnd.dailyTasks        = dailyTasks;
						convo.dayEnd.startSessionGroup = startSessionGroup;

						startEndDayFlow(err, convo);

		    		// on finish conversation
		    		convo.on('end', (convo) => {

		  				var responses = convo.extractResponses();


		    			if (convo.status == 'completed') {

		    				const { UserId, reflection, dailyTasks, startSessionGroup } = convo.dayEnd;
		  					const startSessionGroupTime = moment(startSessionGroup.dataValues.createdAt);

		    				var now = moment();

		    				// log `end_work` and reflection
		    				models.SessionGroup.create({
		    					type: "end_work",
		    					UserId,
		    					reflection
		    				});

		    				// end all open work sessions. should only be one for the user
		    				user.getWorkSessions({
									where: [ `"open" = ? OR "live" = ?`, true, true ]
								})
								.then((workSessions) => {
									workSessions.forEach((workSession) => {
										workSession.update({
											endTime: now,
											open: false,
											live: false
										})
									})
								})

								// put all of user's `live` tasks to pending
								// make all pending tasks => archived, then all live tasks => pending
		    				user.getDailyTasks({
		    					where: [`"DailyTask"."type" = ?`, "pending"]
		    				})
		    				.then((dailyTasks) => {
		    					dailyTasks.forEach((dailyTask) => {
						        dailyTask.update({
						          type: "archived"
						        });
						      });
						      user.getDailyTasks({
			    					where: [`"DailyTask"."type" = ?`, "live"]
			    				})
			    				.then((dailyTasks) => {
			    					dailyTasks.forEach((dailyTask) => {
							        dailyTask.update({
							          type: "pending"
							        });
							      });
			    				});
		    				});
		    				resumeQueuedReachouts(bot, { SlackUserId });

		    			} else {
		    				// default premature end
								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
									resumeQueuedReachouts(bot, { SlackUserId });
									convo.say("Okay! Exiting now. Let me know when you want to start your day!");
									convo.next();
								});
		    			}
		    		});
					});
				})
	    });
		})
	});
};

// start of end day flow
function startEndDayFlow(response, convo) {

	const { task, name }          = convo;
	const { bot, source_message } = task;
	const { dailyTasks }          = convo.dayEnd

	convo.say(`Let's wrap up for the day :package:`);

	if (dailyTasks.length > 0) {
		convo.say(`Here are the tasks you completed today:`);
		var taskListMessage = convertArrayToTaskListMessage(dailyTasks);
		convo.say(taskListMessage);
	}

	getTotalWorkSessionTime(response, convo);

}

// calculate total work session time before continuing
function getTotalWorkSessionTime(response, convo) {

	const { task, name }                    = convo;
	const { bot, source_message }           = task;
	const { UserId, dailyTasks, startSessionGroup } = convo.dayEnd

	var now = moment();

	// get all the work sessions started between now and most recent startSessionGroup
	models.User.find({
		where: { id: UserId }
	}).then((user) => {
		return user.getWorkSessions({
			where: [`"WorkSession"."startTime" > ?`, startSessionGroup.dataValues.createdAt]
		})
	})
	.then((workSessions) => {
		var totalFocusedMinutes = 0;
		// calculate time between these
		workSessions.forEach((workSession) => {
			var startTime = moment(workSession.startTime);
			var endTime   = moment(workSession.endTime);

			// for the scenario they are ending day to end a session
			// we will do actual updates at `convo.on('end')`
			if (endTime > now)
				endTime = now;
			var minutesDuration = Math.round(moment.duration(endTime.diff(startTime)).asMinutes());
			totalFocusedMinutes += minutesDuration;

		})
		convo.say(`You spent ${totalFocusedMinutes} minutes in focused sessions with me`);
		askForReflection(response, convo);
	});

}

// ask if user wants reflection
function askForReflection(response, convo) {

	const { task, name }                    = convo;
	const { bot, source_message }           = task;
	const { dailyTasks, startSessionGroup } = convo.dayEnd

	convo.say(`Is there anything specific you'd like to remember about your work day? :pencil:`);
	convo.say(`I'll remember this for you and be able to present it back to you soon :bulb:`);
	convo.ask(`This could be how you felt about your time, focus, or anything else!`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.ask(`Awesome! What would you like to remember about today?`, (response, convo) => {
					getReflectionText(response, convo);
					convo.next();
				});
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Totally cool! :thumbsup:");
				convo.say("See you tomorrow! :wave:");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				getReflectionText(response, convo);
				convo.next();
			}
		}
	]);

	convo.next();

}

// get reflection and end the day
function getReflectionText(response, convo) {

	const { task, name }                    = convo;
	const { bot, source_message }           = task;
	const { dailyTasks, startSessionGroup } = convo.dayEnd;
	var responseMessage                     = response.text;

	// for now it is single enter that will be saved as the reflection
	convo.dayEnd.reflection = responseMessage;
	convo.say(`Great!`);
	convo.say("See you tomorrow! :wave:");

}






