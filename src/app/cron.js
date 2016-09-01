import { bots, controller } from '../bot/controllers';
import models from './models';
import moment from 'moment-timezone';
import _ from 'lodash';
import { colorsHash, constants } from '../bot/lib/constants';
import { sendGroupPings } from '../bot/controllers/pings/pingFunctions';

// the cron file!
export default function() {

	if (bots) {
		// cron job functions go here
		checkForSessions()
		checkForPings()
	}

}

// these are all pings that are not sessionEnd
let checkForPings = () => {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	let now       = moment();
	let nowString = now.format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	// turn all work sessions off for that user once you ping that user
	models.Ping.findAll({
		where: [ `"Ping"."live" = ? AND "Ping"."deliveryType" != ?`, true, constants.pingDeliveryTypes.sessionEnd ],
		order: `"Ping"."createdAt" ASC`,
		include: [
			{ model: models.User, as: `FromUser` },
			{ model: models.User, as: `ToUser` },
			models.PingMessage
		]
	}).then((pings) => {

		const groupPings = { fromUser: {} };

		// group pings together by unique FromUser => ToUser combo
		pings.forEach((ping) => {
			
			const { FromUserId, ToUserId, deliveryType, pingTime } = ping.dataValues;

			if (groupPings.fromUser[FromUserId]) {

				if (groupPings.fromUser[FromUserId].toUser[ToUserId]) {
					groupPings.fromUser[FromUserId].toUser[ToUserId].push(ping);
				} else {
					groupPings.fromUser[FromUserId].toUser[ToUserId] = [ ping ];
				}

			} else {
				
				groupPings.fromUser[FromUserId] = { toUser: {} };
				groupPings.fromUser[FromUserId].toUser[ToUserId] = [ ping ];

			}

		})

		// send all unique group pings!
		for (let fromUserId in groupPings.fromUser) {
			
			if (!groupPings.fromUser.hasOwnProperty(fromUserId)) {
				continue;
			}

			for (let toUserId in groupPings.fromUser[fromUserId].toUser) {
				
				if (!groupPings.fromUser[fromUserId].toUser.hasOwnProperty(toUserId)) {
					continue;
				}

				const pings = groupPings.fromUser[fromUserId].toUser[toUserId];
				let pingPromises = [];
				pings.forEach((ping) => {
					pingPromises.push(models.Ping.update({
						live: false
					},{
						where: { id: ping.dataValues.id }
					}));
				});

				if (pings.length > 0) {
					// right now just proxy to first delivery type (they should all be the same)
					const deliveryType = pings[0].dataValues.deliveryType;
					if (sendGroupPings(pings, deliveryType)) {
						Promise.all(pingPromises);
					}
				}

			}

		}

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