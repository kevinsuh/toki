import { bot } from '../server';
import { controller } from '../bot/controllers';

// sequelize models
import models from './models';

import moment from 'moment';

// the cron file!
export default function() {

	// check for reminders every minute!
	console.log("hello every minute from cron file");
	checkForReminders();

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
			
			const { UserId, type, open } = reminder;

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

		    	var message;
		    	switch (type) {
		    		case 'work_session':
		    			// if work session, get the time passed since start of session
		    			message = `Hey! Hope you're doing well in your session :weight_lifter:`;
		    		default:
		    		message = `Hey! You wanted a reminder :alarm_clock: `;
		    	}
		    	console.log(type);
		    	
		    	message = `Hey! You wanted a reminder :smiley: :alarm_clock: `;
		    	convo.say(message);
		    });

		  });

		});
	});
}