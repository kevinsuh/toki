import moment from 'moment-timezone';
import models from '../../../app/models';
import _ from 'lodash';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments, letsFocusAttachments, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, commaSeparateOutStringArray, stringifyNumber, getPingMessageContentAsAttachment, getHandleQueuedPingActions } from '../../lib/messageHelpers';

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
export function startEndSessionFlow(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingContainers, pingInfo, mutualSessionEndingPings }  = convo.sessionEnd;

	let startTimeObject;
	let endTimeObject;
	let endTimeString;
	let sessionMinutes;
	let sessionTimeString;
	let message = ' ';
	let letsFocusMessage = `When you’re ready, let me know when you’d like to \`/focus\` again`;

	// add session info (the one that just got ended) if existing
	// this is not the case when you have queued ping
	// and other user is done w/ session
	if (session) {
		const { dataValues: { content, startTime, endTime } } = session;
		startTimeObject   = moment(startTime).tz(tz);
		endTimeObject     = moment(endTime).tz(tz);
		endTimeString     = endTimeObject.format("h:mm a");
		sessionMinutes    = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
		sessionTimeString = convertMinutesToHoursString(sessionMinutes);
	}

	if (mutualSessionEndingPings && !_.isEmpty(mutualSessionEndingPings)) {

		// ping ends both sessions together
		
		const { fromSessionEndingUser, fromSessionEndingUserPings, toSessionEndingUser, toSessionEndingUserPings } = mutualSessionEndingPings;

		// this is the user who ended the session!
		if (fromSessionEndingUser && fromSessionEndingUser.dataValues.SlackUserId == SlackUserId) {
			
			message = `While you were heads down, you and <@${toSessionEndingUser.dataValues.SlackUserId}> wanted to send a message to each other`;

		} else if (toSessionEndingUser && toSessionEndingUser.dataValues.SlackUserId == SlackUserId) {

			message = `Hey! <@${fromSessionEndingUser.dataValues.SlackUserId}> finished their session`;
			if (pingInfo.endSessionType == constants.endSessionTypes.endSessionEarly) {
				message = `${message} early`;
			}
			message = `${message}, and you two wanted to send a message to each other`

		}

		message = `${message}\n:point_left: I just kicked off a conversation between you two`;

		if (pingInfo && pingInfo.session) {
			letsFocusMessage = `I ended your focused session on \`${session.dataValues.content}\`. ${letsFocusMessage}`;
		}

	} else if (endSessionType == constants.endSessionTypes.endByPingToUserId && pingInfo && pingInfo.FromUser.dataValues.id == UserId) {

		// just a one-way ended by session end
		
		const { FromUser, ToUser } = pingInfo;

		message = `Hey! <@${ToUser.dataValues.SlackUserId}> finished their session`;
		if (pingInfo.endSessionType == constants.endSessionTypes.endSessionEarly) {
			message = `${message} early`;
		}
		message = `${message}\n:point_left: I just kicked off a conversation between you two`;

		if (pingInfo.session) {
			letsFocusMessage = `I ended your focused session on \`${session.dataValues.content}\`. ${letsFocusMessage}`;
		}

	} else if (session) { // session must exist for all endSessionTypes other than endByPingToUserId
		message = `Great work on \`${session.dataValues.content}\`! You were focused for *${sessionTimeString}*`;
	}

	convo.say(message);
	handleToUserPings(convo);
	handleFromUserPings(convo);

	convo.say({
		text: letsFocusMessage
	});

	convo.next();

}

// this handles messaging for all pings to user of ending session
function handleToUserPings(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingInfo, pingContainers }  = convo.sessionEnd;
	
	let slackUserIds = [];
	for (let fromUserId in pingContainers.toUser.fromUser) {
		
		if (!pingContainers.toUser.fromUser.hasOwnProperty(fromUserId)) {
			continue;
		}

		const pingContainer = pingContainers.toUser.fromUser[fromUserId];
		const FromUser      = pingContainer.user;

		// do not include the user who ended session together
		if (pingInfo && pingInfo.thisPingEndedUsersSessionsTogether && pingInfo.FromUser.dataValues.SlackUserId == FromUser.dataValues.SlackUserId) {
			continue;
		}

		if (!_.includes(slackUserIds, FromUser.dataValues.SlackUserId)) {
			slackUserIds.push(FromUser.dataValues.SlackUserId);
		}
	}

	if (slackUserIds.length > 0) {

		let message;

		let slackNamesString = commaSeparateOutStringArray(slackUserIds, { SlackUserIds: true });

		if (slackUserIds.length == 1) {
			message = `While you were heads down, ${slackNamesString} asked me to send you a message after your session :relieved:\n:point_left: I just kicked off a conversation between you both`
		} else { // > 1
			message = `While you were heads down, you received messages from ${slackNamesString}\n:point_left: I just kicked off separate conversations between you and each of them`;
		}

		convo.say(message);

	}

	convo.next();

}

// this handles messaging for all pings by the user of ending session
function handleFromUserPings(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingInfo, pingContainers }  = convo.sessionEnd;
	let message;

	// `UserId` == `fromUserId` because it is this user who is ending session
	for (let toUserId in pingContainers.fromUser.toUser) {
		
		if (!pingContainers.fromUser.toUser.hasOwnProperty(toUserId)) {
			continue;
		}

		const pingContainer = pingContainers.fromUser.toUser[toUserId];

		// if ToUser from this user is not in a superFocus session and they also have msg pinged for you,
		// then their session will end automatically (so no need to handle it here)
		if ((!pingContainer.session || pingContainer.session && !pingContainer.session.dataValues.superFocus) && pingContainers.toUser.fromUser[toUserId]) {
			pingContainer.thisPingEndedUsersSessionsTogether = true;
			pingContainers.fromUser.toUser[toUserId]         = pingContainer;
			continue;
		}

		const { session, pings } = pingContainer;
		const ToUser             = pingContainer.user;

		if (session) {

			const { dataValues: { content, endTime } } = session;
			const endTimeString = moment(endTime).tz(ToUser.dataValues.tz).format("h:mma");

			let sessionMessage = `<@${ToUser.dataValues.SlackUserId}> is focusing on \`${content}\` until *${endTimeString}*.`;

			// separation when only queued 1 ping vs many pings
			if (pings.length == 1) {

				sessionMessage = `${sessionMessage}  I'll send this ping then, unless you think it's urgent and want to send now:`;

				const ping      = pings[0];
				let attachments = getPingMessageContentAsAttachment(ping);
				let actions     = getHandleQueuedPingActions(ping);

				attachments.push({
					attachment_type: 'default',
					callback_id: "HANDLE_QUEUED_PING_TO_USER",
					fallback: `What do you want to do with this ping?`,
					actions
				});

				convo.say({
					text: sessionMessage,
					attachments
				})

			} else {
				// if > 1 pings queued, only 1 session message and then send content out for each ping
				sessionMessage = `${sessionMessage}  I'll send your pings then, unless you think it's urgent and want to send now:`;
				convo.say(sessionMessage);

				pings.forEach((ping, index) => {

					const numberString = stringifyNumber(index + 1);

					let attachments = getPingMessageContentAsAttachment(ping);
					let actions     = getHandleQueuedPingActions(ping);
					attachments.push({
						attachment_type: 'default',
						callback_id: "HANDLE_QUEUED_PING_TO_USER",
						fallback: `What do you want to do with this ping?`,
						actions
					});

					convo.say({
						text: `*Here's your ${numberString} ping:*`,
						attachments
					})
				});

			}

		} else {
			convo.say(`<@${ToUser.dataValues.SlackUserId}> is not in a focused session, so I just started a conversation between you two :simple_smile:`);
		}

	}

}

