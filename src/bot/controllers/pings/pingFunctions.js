import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, getRandomExample, commaSeparateOutStringArray, getMostRecentMessageToUpdate } from '../../lib/messageHelpers';

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
						convo.say(`:point_left: <@${user.dataValues.SlackUserId}> is not a focused work session right now, so I started a conversation for you`);
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

	const { SlackUserId, bot, tz, userInSession }  = convo.pingObject;

	if (userInSession) {
		// we gathered appropriate info about user
		const { user, endTimeObject } = userInSession;
		const endTimeString = endTimeObject.format("h:mma");

		

		let text = `What would you like me to send <@${user.dataValues.SlackUserId}> at *${endTimeString}*?`;
		let attachments = [{
			text: "Enter as many lines as you’d like to include in the message then choose one of the send options when your message is ready to go\n(These few lines will delete after you type your first line and hit Enter :wink:)",
			attachment_type: 'default',
			callback_id: "PING_MESSAGE_LIST",
			fallback: "What is the message you want to queue up?"
		}];

		convo.ask({
			text,
			attachments
		}, [
			{
				pattern: utterances.containsSendAt,
				callback: (response, convo) => {
					// 
				}
			},
			{
				pattern: utterances.sendSooner,
				callback: (response, convo) => {

				}
			},
			{
				default: true,
				callback: (response, convo) => {

					let pingMessageListUpdate = getMostRecentMessageToUpdate(response.channel, bot, "PING_MESSAGE_LIST");
					if (pingMessageListUpdate) {

						attachments[0].actions = [
							{
								name: buttonValues.sendAtEndOfSession.name,
								text: `Send at ${endTimeString}`,
								value: buttonValues.sendAtEndOfSession.value,
								type: `button`
							},
							{
								name: buttonValues.sendSooner.name,
								text: `:bomb: Send sooner :bomb:`,
								value: buttonValues.sendSooner.value,
								type: `button`
							}
						];
						attachments[0].text = `UPDATED TEXT`;

						pingMessageListUpdate.attachments = JSON.stringify(attachments);
						console.log(pingMessageListUpdate);
						bot.api.chat.update(pingMessageListUpdate);

					}

				}
			}
		]);



	} else {
		startPingFlow(convo);
	}

}

