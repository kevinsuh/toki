import { wit } from '../controllers/index';
import models from '../../app/models';

// add receive middleware to controller
export default (controller) => {

	controller.middleware.receive.use(wit.receive);

	controller.middleware.receive.use((bot, message, next) => {

		var { bot_id } = message;
		if (bot_id) {
			// attach the message to the bot
			var { sentMessages } = bot;
			if (sentMessages) {
				bot.sentMessages.push(message);
			} else {
				bot.sentMessages = [ message ];
			}
		}
		
		next();

	});

	// middleware to handle the pausing of cron jobs
	// this middleware will turn off all existing work sessions
	// then add them to bot.queuedReachouts, which will be called
	// at the end of each conversation to turn back on
	controller.middleware.receive.use((bot, message, next) => {

		if (!bot.queuedReachouts) {
			bot.queuedReachouts = {};
		}

		if (message.user && message.type) {

			// safeguard to prevent messages being sent by bot
			var botSlackUserId = false;
			if (bot.identity && bot.identity.id) {
				botSlackUserId = bot.identity.id;
			}

			const SlackUserId = message.user;

			// various safe measures against running pauseWorkSession functionality
			var valid = true;
			if (typeof SlackUserId != "string") {
				console.log(`SlackUserId is not a string: ${SlackUserId}`);
				valid = false;
			} else if (botSlackUserId == SlackUserId) {
				console.log(`This message is being sent by bot: ${SlackUserId}`);
				valid = false;
			}

			if (message.type == "message" && message.text && valid) {

				console.log(`\n ~~ this message affects pauseWorkSession middleware ~~ \n`);

				// if found user, find the user
				models.User.find({
					where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
					include: [
						models.SlackUser
					]
				})
				.then((user) => {

					if (user) {

						user.getWorkSessions({
							where: [`"live" = ?`, true ]
						})
						.then((workSessions) => {

							// found a work session! (should be <= 1 per user)
							if (workSessions.length > 0) {

								var pausedWorkSessions = [];
								workSessions.forEach((workSession) => {

									workSession.update({
										live: false
									});

									pausedWorkSessions.push(workSession);

								});

								// queued reachout has been created for this user
								if (bot.queuedReachouts[SlackUserId] && bot.queuedReachouts[SlackUserId].workSessions) {
									pausedWorkSessions.forEach((workSession) => {
										bot.queuedReachouts[SlackUserId].workSessions.push(workSession);
									});
								} else {
									bot.queuedReachouts[SlackUserId] = {
										workSessions: pausedWorkSessions
									}
								}
							}

							next();

						})
					} else {
						next();
					}

				});
			} else {
				console.log(`\n ~~ this event did not affect pause middleware ~~ \n`);
				next();
			}

		}

	})

}