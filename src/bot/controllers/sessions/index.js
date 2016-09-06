import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import startSessionController from './startSession';
import endSessionController from './endSession';

// base controller for work sessions!
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startSessionController(controller);
	endSessionController(controller);

	// get current session status!
	controller.on('current_session_status', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: { SlackUserId }
		}).then((user) => {

			user.getSessions({
				where: [`"open" = ?`, true]
			})
			.then((sessions) => {
				// need user's timezone for this flow!
				const { tz } = user;
				const UserId = user.id;

				let currentSession = sessions[0];

				if (currentSession && tz) { // if in session, means you have your tz config'd
					
					let now           = moment().tz(tz);
					let endTime       = moment(currentSession.dataValues.endTime).tz(tz);
					let endTimeString = endTime.format("h:mma");
					
					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
						convo.say(`You're in a session right now for \`${currentSession.dataValues.content}\`. Keep focusing and I'll see you at *${endTimeString}* :raised_hands:`);
					});

				} else {
					// ask to start new session!
					notInSessionWouldYouLikeToStartOne({bot, SlackUserId, controller});
				}
			});

		});
	});

};

export function notInSessionWouldYouLikeToStartOne(config) {
	const { bot, SlackUserId, controller } = config;
	if (bot && SlackUserId && controller) {
		bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
			convo.ask(`You're not in a session right now! Would you like to start one?`, [
				{
					pattern: utterances.yes,
					callback: (response, convo) => {
						convo.startSession = true;
						convo.next();
					}
				},
				{
					pattern: utterances.no,
					callback: (response, convo) => {
						convo.say("Okay! Let me know when you want to `/focus` :smile_cat:");
						convo.next();
					}
				},
				{
					default: true,
					callback: (response, convo) => {
						convo.say("Sorry, I didn't catch that");
						convo.repeat();
						convo.next();
					}
				}
			]);
			convo.next();
			convo.on('end', (convo) => {
				if (convo.startSession) {
					controller.trigger(`begin_session_flow`, [bot, null, config]);
				}
			});
		});
	}
}