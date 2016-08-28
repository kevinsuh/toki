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
	controller.on(`end_session_flow`, (bot, config) => {

		const { SlackUserId, sessionTimerUp, endSessionEarly } = config;

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

						// get all `endSession` pings
						// for each one, check if the `fromUserId` is in a session of `superFocus`! If so, do not include ping here
						models.Ping.findAll({
							where: [ `"Ping"."ToUserId" = ? AND "Ping"."live" = ? AND "Ping"."deliveryType" = ?`, UserId, true, "sessionEnd" ],
							order: `"Ping"."createdAt" DESC`
						}).then((pings) => {

							// this must be treated synchronously...
							let pingObjects           = [];
							let pingerSessionPromises = [];

							pings.forEach((ping) => {

								const { FromUserId } = ping;
								pingerSessionPromises.push(models.Session.find({
									where: {
										UserId: FromUserId,
										live: true,
										open: true
									}
								}));

							});

							Promise.all(pingerSessionPromises)
							.then((pingerSessions) => {

								// active sessions of pingers FromUserId
								pings.forEach((ping) => {

									let pingObject = {};
									let session    = false;

									pingerSessions.forEach((pingerSession) => {

										// include live session from pinger if exists
										if (pingerSession && pingerSession.dataValues.UserId == ping.dataValues.FromUserId) {
											session = pingerSession;
											return;
										}
									});

									pingObject.ping    = ping;
									pingObject.session = session;

									pingObjects.push(pingObject);

								});

								// CONSOLE LOG PROOF THAT IT WORKS!
								pingObjects.forEach((pingObject) => {
									console.log(`\n\nPing id: ${pingObject.ping.dataValues.id}`);
									if (pingObject.session) {
										console.log(`Session id: ${pingObject.session.dataValues.id}`);
									} else {
										console.log(`NO SESSION`);
									}
									console.log("\n\n\n")
								})

								let startTimeObject   = moment(session.dataValues.startTime).tz(tz);
								let endTimeObject     = moment(session.dataValues.endTime).tz(tz);
								let endTimeString     = endTimeObject.format("h:mm a");
								let sessionMinutes    = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
								let sessionTimeString = convertMinutesToHoursString(sessionMinutes);

								bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

									// have 5-minute exit time limit
									convo.task.timeLimit = 1000 * 60 * 5;

									convo.sessionEnd = {
										UserId,
										SlackUserId,
										tz,
										endSessionEarly,
										sessionTimerUp
									}

									if (sessionTimerUp) {
										convo.say(`Your session is up!`);
									}

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



