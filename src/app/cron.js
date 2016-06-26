import { bots } from '../bot/controllers';
import { controller } from '../bot/controllers';

// sequelize models
import models from './models';

import moment from 'moment';

// the cron file!
export default function() {

	console.log("BOTS!");
	for (var token in bots) {
		console.log(`token: ${token}`);
	}

	// check for reminders and sessions every minute!
	checkForReminders();
	checkForSessions();

}

var checkForSessions = () => {

	// var now = moment();
	// var fiveMinutesAgo = now.subtract(5, "minutes").format("YYYY-MM-DD HH:mm:ss");
	
	models.WorkSession.findAll({
		where: [ `"endTime" < ? AND open = ?`, new Date(), true ]
	}).then((workSessions) => {

		// these are the work sessions that have ended within last 5 minutes
		// and have not closed yet
		
		var workSessionsArray = [];

		workSessions.forEach((workSession) => {

			const { UserId, open } = workSession;

			/**
			 * 		For each work session
			 * 			1. close it
			 * 			2. find user and start end_work_session flow
			 */
			
			workSession.update({
				open: false
			})
			.then(() => {
				return models.User.find({
					where: { id: UserId },
					include: [ models.SlackUser ]
				});
			})
			.then((user) => {

				var { SlackUserId } = user.SlackUser;
				var config = {
					SlackUserId
				}

				// alarm is up for session
				controller.trigger('session_timer_up', [bot, config]);
				
			})

		});

	});
}

var checkForReminders = () => {
	// this is for testing
	// var oneMinute = moment().add(5,'minutes').format("YYYY-MM-DD HH:mm:ss");

	models.Reminder.findAll({
		where: [`"remindTime" < ? AND open = ?`, new Date(), true]
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

		  });

		});
	});
}