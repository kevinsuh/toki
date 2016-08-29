import { bots, controller } from '../bot/controllers';
import models from './models';
import moment from 'moment-timezone';
import _ from 'lodash';
import { colorsHash, constants } from '../bot/lib/constants';
import { sendPing } from '../bot/controllers/pings/pingFunctions';

// the cron file!
export default function() {

	if (bots) {
		// cron job functions go here
		checkForSessions()
		checkForPings()
	}

}

let checkForPings = () => {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	let now       = moment();
	let nowString = now.format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	// turn all work sessions off for that user once you ping that user
	models.Ping.findAll({
		where: [ `"Ping"."live" = ? AND "Ping"."deliveryType" != ?`, true, "sessionEnd" ],
		order: `"Ping"."createdAt" DESC`
	}).then((pings) => {

		pings.forEach((ping) => {

			const { FromUserId, ToUserId, deliveryType, pingTime } = ping;

			// if there's a pingTime, respect it and dont send yet!
			if (pingTime) {
				let pingTimeObject = moment(pingTime);
				if (pingTimeObject > now) {
					return;
				}
			}

			ping.getPingMessages({})
			.then((pingMessages) => {
				models.User.find({
					where: { id: FromUserId }
				})
				.then((fromUser) => {

					const fromUserTeamId = fromUser.TeamId;

					models.User.find({
						where: { id: ToUserId }
					})
					.then((toUser) => {

						const toUserTeamId = toUser.TeamId;

						if (fromUserTeamId != toUserTeamId) {
							// ERROR ERROR -- this should never happen!
							return;
						}

						ping.update({
							live: false
						})
						.then(() => {

							const fromUserConfig = {
								UserId: fromUser.dataValues.id,
								SlackUserId: fromUser.dataValues.SlackUserId,
								TeamId: fromUser.dataValues.TeamId
							};
							const toUserConfig = {
								UserId: toUser.dataValues.id,
								SlackUserId: toUser.dataValues.SlackUserId,
								TeamId: toUser.dataValues.TeamId
							}
							const config = {
								deliveryType,
								pingMessages
							};

							sendPing(fromUserConfig, toUserConfig, config);
						})

					})
				});
			})

		});
	});

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
							SlackUserId
						}

						models.Team.find({
							where: { TeamId }
						})
						.then((team) => {
							const { token } = team;
							let bot = bots[token];
							if (bot) {
								// alarm is up for session
								config.endSessionType = constants.endSessionTypes.sessionTimerUp;
								controller.trigger(`end_session_flow`, [bot, config ]);
							}
						});
					})
				}

			});
		});
	});
}