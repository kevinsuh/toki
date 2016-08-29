import { wit, bots } from '../index';
import moment from 'moment-timezone';
import models from '../../../app/models';

import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString } from '../../lib/messageHelpers';
import { startEndSessionFlow } from './endSessionFunctions';


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
		const endSessionType   = `endEarly`;

		const config = { SlackUserId, endSessionType };

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(() => {
			controller.trigger(`end_session_flow`, [bot, config]);
		}, 800);

	});

	/**
	 * 		User has confirmed to ending session
	 * 		This will immediately close the session, then move to
	 * 		specified "post session" options
	 */
	controller.on(`end_session_flow`, (bot, config) => {

		const { SlackUserId, endSessionType } = config;

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

					// only update endTime if it is less than current endTime
					let now     = moment();
					let endTime = moment(session.dataValues.endTime);
					if ( now < endTime )
						endTime = now;

					session.update({
						open: false,
						live: false,
						endTime
					})
					.then((session) => {

						// turn off all sessions for user here
						// just in case other pending open sessions (should only have one open a time per user!)
						models.Session.update({
							open: false,
							live: false
						}, {
							where: [ `"Sessions"."UserId" = ? AND ("Sessions"."open" = ? OR "Sessions"."live" = ?)`, UserId, true, true ]
						});

						/*
						 * 	1. get all the `endSession` pings for ToUserId 
						 * 	2. get all the live sessions for FromUserId (pingers)
						 * 	3. match up sessions with pings into `pingObject` (`pingObject.ping` && `pingObject.session`)
						 * 	4. run logic based on whether ping has session
						 */

						models.Ping.findAll({
							where: [ `("Ping"."ToUserId" = ? OR "Ping"."FromUserId" = ?) AND "Ping"."live" = ? AND "Ping"."deliveryType" = ?`, UserId, UserId, true, "sessionEnd" ],
							include: [
								{ model: models.User, as: `FromUser` },
								{ model: models.User, as: `ToUser` },
							],
							order: `"Ping"."createdAt" DESC`
						}).then((pings) => {

							// this object holds pings in relation to the UserId of the session that just ended!
							// fromUser are pings that the user sent out
							// toUser are pings that got sent to the user
							let pingObjects = {
								fromUser: [],
								toUser: []
							};

							// get all the sessions associated with pings that come FromUser
							let pingerSessionPromises = [];
							pings.forEach((ping) => {
								const { FromUserId } = ping;
								pingerSessionPromises.push(models.Session.find({
									where: {
										UserId: FromUserId,
										live: true,
										open: true
									},
									include: [ models.User ]
								}));
							});

							Promise.all(pingerSessionPromises)
							.then((pingerSessions) => {

								// create the pingObject by matching up `ping` with live `session`
								// if no live session, `session` will be false
								pings.forEach((ping) => {
									let pingObject = {};
									let session    = false;
									pingerSessions.forEach((pingerSession) => {
										if (pingerSession && pingerSession.dataValues.UserId == ping.dataValues.FromUserId) {
											session = pingerSession;
											return;
										}
									});
									pingObject.ping    = ping;
									pingObject.session = session;
									if (ping.dataValues.FromUserId == UserId) {
										pingObjects.fromUser.push(pingObject);
									} else if (ping.dataValues.ToUserId == UserId) {
										pingObjects.toUser.push(pingObject);
									}
								});

								// attach only the relevant pingObjects (ones where FromUserId is not in live session or `superFocus` session)
								pingObjects.toUser = pingObjects.toUser.filter(pingObject => !pingObject.session || !pingObject.session.dataValues.superFocus );

								pingObjects.fromUser = pingObjects.fromUser.filter(pingObject => !pingObject.session || !pingObject.session.dataValues.superFocus );

								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

									// have 5-minute exit time limit
									convo.task.timeLimit = 1000 * 60 * 5;

									convo.sessionEnd = {
										UserId,
										SlackUserId,
										tz,
										session, // session that just ended
										pingObjects, // all `endSession` pings to handle
										endSessionType
									}

									// start the flow
									startEndSessionFlow(convo);

									convo.on('end', (convo) => {

									});
								
								});

							});

						});

					});
				}
			});

		});

	});

}



