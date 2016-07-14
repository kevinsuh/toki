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

		if (message.user) {

			console.log(`\n\n ~~ queued reachouts middleware for SlackUserId: ${message.user} ~~ \n\n`);

			const SlackUserId = message.user;

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
						where: [`"open" = ? AND "live" = ?`, true, true ]
					})
					.then((workSessions) => {

						// found a work session! (should be <= 1 per user)
						if (workSessions.length > 0) {

							// make sure to not queue up more than 1 of the same workSession
							var existingPausedWorkSessionIds = [];
							if (bot.queuedReachouts[SlackUserId] && bot.queuedReachouts[SlackUserId].workSessions) {
								existingPausedWorkSessionIds = bot.queuedReachouts[SlackUserId].workSessions.map((workSession) => {
									return workSession.dataValues.id;
								});
							}

							var pausedWorkSessions = [];
							workSessions.forEach((workSession) => {

								workSession.update({
									live: false,
									open: false
								});

								// make sure it is not already queued to add to
								// bot.queuedReachouts
								if (existingPausedWorkSessionIds.indexOf(workSession.dataValues.id) < 0) {
									pausedWorkSessions.push(workSession);
								}

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

						console.log("\n\n ~~ queuedReachouts for User: ~~");
						console.log(bot.queuedReachouts);

						next();

					})
				} else {
					next();
				}

			});

		} else {
			next();
		}

	})

}