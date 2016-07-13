import { bots } from '../bot/controllers';
import { controller } from '../bot/controllers';
import { constants } from './lib/constants';

// sequelize models
import models from './models';

import moment from 'moment';

// the cron file!
export default function() {

	// check for reminders and sessions every minute!
	
	if (bots) {
		checkForReminders();
		checkForSessions();
	}

}

var checkForSessions = () => {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = moment.tz("America/New_York").format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	models.WorkSession.findAll({
		where: [ `"endTime" < ? AND "live" = ? AND "open" = ?`, now, true, true ],
		order: `"WorkSession"."createdAt" DESC`,
		include: [ models.DailyTask ]
	}).then((workSessions) => {
		
		var workSessionsArray = [];

		workSessions.forEach((workSession) => {

			const { UserId, open, live } = workSession;

			/**
			 * 		For each work session
			 * 			1. close it
			 * 			2. find user and start end_work_session flow
			 */
			
			workSession.update({
				live: false
			})
			.then((workSession) => {
				models.User.find({
					where: { id: UserId },
					include: [ models.SlackUser ]
				})
				.then((user) => {

					var { SlackUserId } = user.SlackUser;
					var config = {
						SlackUserId,
						workSession
					}

					// we need to find the bot that contains this user
					// 1. find team of slack user
					// 2. get token of that team
					// 3. get that bot by token
					
					const { SlackUser: { TeamId } } = user;

					models.Team.find({
						where: { TeamId }
					})
					.then((team) => {
						const { token } = team;
						var bot = bots[token];
						if (bot) {
							// alarm is up for session
							controller.trigger('session_timer_up', [bot, config]);
						}
					});

				})
			})

		});

	});
}

var checkForReminders = () => {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = moment.tz("America/New_York").format("YYYY-MM-DD HH:mm:ss Z");

	models.Reminder.findAll({
		where: [`"remindTime" < ? AND open = ?`, now, true]
	}).then((reminders) => {

		// these are all reminders that have passed expiration date
		// yet have not been closed yet
		var remindersArray = [];
		reminders.forEach((reminder) => {
			
			const { UserId, open } = reminder;

			// for each open reminder:
			// 1. close the reminder
			// 2. find the user of the reminder
			// 3. send the reminder
			
			reminder.update({
					open: false
			 })
			.then(() => {
				return models.User.find({
					where: { id: UserId },
					include: [
						models.SlackUser
					]
				})
				
			})
			.then((user) => {

				const { SlackUser: { TeamId, SlackUserId } } = user;

				models.Team.find({
					where: { TeamId }
				})
				.then((team) => {
					const { token } = team;
					var bot = bots[token];

					if (bot) {

						if (reminder.type == constants.reminders.doneSessionSnooze) {
							
							const UserId = user.id;
							user.getWorkSessions({
								where: [`"WorkSession"."UserId" = ?`, UserId],
								order: `"WorkSession"."createdAt" DESC`,
								limit: 1
							})
							.then((workSessions) => {
								// get most recent work session for snooze option
								if (workSessions.length > 0) {
									var workSession = workSessions[0];
									workSession.getDailyTasks({})
									.then((dailyTasks) => {
										workSession.DailyTasks = dailyTasks;
										var config = {
											workSession,
											SlackUserId
										}
										controller.trigger(`session_timer_up`, [ bot, config ]);
									})
								}
							})

						} else {
							// alarm is up for reminder
							// send the message!
							bot.startPrivateConversation({
								user: user.SlackUser.SlackUserId 
							}, (err, convo) => {

								if (convo) {
									var customNote = reminder.customNote ? `(\`${reminder.customNote}\`)` : '';
									var message = `Hey! You wanted a reminder ${customNote} :smiley: :alarm_clock: `;

									convo.say(message);
								}
								
							});
						}

					}
				});

			});

		});
	});
}