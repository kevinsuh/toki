import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { buttonValues, colorsHash } from '../../lib/constants';


// END OF A WORK SESSION
export default function(controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['end_session'], 'direct_message', wit.hears, (bot, message) => {

		let botToken = bot.config.token;
		bot          = bots[botToken];

		/**
		 * 			check if user has open session (should only be one)
		 * 					if yes, trigger finish and end_session flow
		 * 			  	if no, reply with confusion & other options
		 */
		
		const SlackUserId      = message.user;
		const doneSessionEarly = true;

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
		}, 800);

	});

	/**
	 * 		User has confirmed to ending session
	 * 		This will immediately close the session, then move to
	 * 		specified "post session" options
	 */
	controller.on(`done_session_flow`, (bot, config) => {

		const { SlackUserId, sessionTimerUp } = config;

		models.User.find({
			where: { SlackUserId }
		})
		.then((user) => {

			const { tz } = user;
			const UserId = user.id;

			user.getSessions({
				where: [ `"open" = ?`, true ],
				order: `"Session"."createdAt" DESC`
			})
			.then((sessions) => {

				let session = sessions[0];

				if (session) {

					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

						// have 5-minute exit time limit
						convo.task.timeLimit = 1000 * 60 * 5;

						convo.sessionEnd = {
							SlackUserId,
							UserId,
							tz
						}

						if (sessionTimerUp) {
							convo.say(`Your session is up!`);
						}

						convo.on('end', (convo) => {

						});
					
					});
				}

			});

		});

	});

}



