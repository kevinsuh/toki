import { bot } from '../server';
import { controller } from '../bot/controllers';

// sequelize models
import models from './models';

// the cron file!
export default function() {
	console.log("hello every minute from cron file");

	var email = "kevinsuh34@gmail.com";
	var message = "hello from cron job!";
	models.User.find({
    where: { email },
    include: [
      models.SlackUser
    ]
  })
  .then((user) => {

    bot.startPrivateConversation({
      user: user.SlackUser.SlackUserId 
    },
    (err, convo) => {
      convo.say(`${message}`);
    });
    
  })

}