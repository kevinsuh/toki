import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getRandomExample, commaSeparateOutStringArray } from '../../lib/messageHelpers';

/**
 * 		PING CONVERSATION FLOW FUNCTIONS
 */

export function startPingFlow(convo) {

	const { SlackUserId, tz, pingSlackUserIds }  = convo.pingObject;

	if (pingSlackUserIds) {
		handlePingSlackUserIds(convo);
	} else {
		askWhoToPing(convo);
	}

}

function askWhoToPing(convo) {

	const { SlackUserId, tz, pingSlackUserIds }  = convo.pingObject;

}

function handlePingSlackUserIds(convo) {

	const { SlackUserId, tz, pingSlackUserIds }  = convo.pingObject;

	if (pingSlackUserIds) {

		let pingSlackUserId              = pingSlackUserIds[0];
		convo.pingObject.pingSlackUserId = pingSlackUserId;

		models.User.find({
			where: { SlackUserId: pingSlackUserId },
		})
		.then((user) => {

			if (user) {

				const { SlackName } = user;

				// we will only handle 1
				if (pingSlackUserIds.length > 1) {
					convo.say(`Hey! Right now I only handle one recipient DM, so I'll be helping you queue for <@${user.dataValues.SlackUserId}>. Feel free to queue another message right after this!`);
				}

				// user found, handle the ping flow!
				user.getSessions({
					where: [ `"open" = ?`, true ],
					order: `"Session"."createdAt" DESC`
				})
				.then((sessions) => {

					let session = sessions[0];

					if (session) {
						// queue the message
						let { content, endTime } = session.dataValues;

						let now           = moment().tz(tz);
						let endTimeObject = moment(endTime).tz(tz);
						let endTimeString = endTimeObject.format("h:mma");
						let minutesLeft   = Math.round(moment.duration(endTimeObject.diff(now)).asMinutes());

						convo.say(`<@${user.dataValues.SlackUserId}> is focusing on \`${content}\` until *${endTimeString}*`);
						convo.pingObject.userInSession = {
							user,
							endTimeObject
						};
						askForQueuedPingMessages(convo);

					} else {
						// send the message
						convo.say(`<@${user.dataValues.SlackUserId}> is not a focused work session right now, so I started a conversation for you (it’s a DM chat :point_left:)`);
						convo.say(`Thank you for being mindful of <@${user.dataValues.SlackUserId}>'s attention :raised_hands:`);
						convo.next();
					}

				});
				
			} else {
				// could not find user
				convo.say(`Sorry, we couldn't recognize that user!`);
				askWhoToPing(convo);
			}

			convo.next();

		});

	} else {
		startPingFlow(convo);
	}

}

function askForQueuedPingMessages(convo) {

	const { SlackUserId, tz, userInSession }  = convo.pingObject;

	if (userInSession) {
		// we gathered appropriate info about user
		const { user, endTimeObject } = userInSession;
		const endTimeString = endTimeObject.format("h:mma");
		convo.ask(`What would you like to send <@${user.dataValues.SlackUserId}> at *${endTimeString}*`);



	} else {
		startPingFlow(convo);
	}

}

