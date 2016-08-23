import { bots, controller } from '../bot/controllers';
import models from './models';
import moment from 'moment-timezone';
import _ from 'lodash';

// the cron file!
export default function() {

	if (bots) {
		// cron job functions go here
		checkForSessions()
	}

}

let checkForSessions = () => {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	let now = moment().format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	// turn all work sessions off for that user once you ping that user
	models.Session.findAll({
		where: [ `"Session"."endTime" < ? AND "Session"."live" = ? AND "Session"."open" = ?`, now, true, true ],
		order: `"Session"."createdAt" DESC`
	}).then((sessions) => {

		let accountedForUserIds = []; // ensure no double-counts

		sessions.forEach((session) => {

			const { UserId, open, live } = session;

			session.update({
				live: false
			})
			.then((session) => {

				// only trigger session if not accounted for yet
				if (!_.includes(accountedForUserIds, UserId)) {
					accountedForUserIds.push(UserId);
					models.User.find({
						where: { id: UserId }
					})
					.then((user) => {
						const { SlackUserId, TeamId } = user;

						let config = {
							SlackUserId,
							session
						}

						models.Team.find({
							where: { TeamId }
						})
						.then((team) => {
							const { token } = team;
							let bot = bots[token];
							if (bot) {
								// alarm is up for session
								const sessionTimerUp  = true;
								config.sessionTimerUp = sessionTimerUp
								controller.trigger(`done_session_flow`, [bot, { SlackUserId, sessionTimerUp }]);
							}
						});
					})
				}

			});
		});
	});
}