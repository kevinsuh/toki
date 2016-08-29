import moment from 'moment-timezone';
import models from '../../../app/models';
import _ from 'lodash';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments, letsFocusAttachments, constants } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, commaSeparateOutStringArray } from '../../lib/messageHelpers';

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
export function startEndSessionFlow(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingObjects, pingInfo }  = convo.sessionEnd;

	let startTimeObject;
	let endTimeObject;
	let endTimeString;
	let sessionMinutes;
	let sessionTimeString;
	let message = ' ';
	let letsFocusMessage = `When you’re ready, let me know when you’d like to focus again`;

	// add session info if existing
	if (session) {
		const { dataValues: { content, startTime, endTime } } = session;
		startTimeObject   = moment(startTime).tz(tz);
		endTimeObject     = moment(endTime).tz(tz);
		endTimeString     = endTimeObject.format("h:mm a");
		sessionMinutes    = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
		sessionTimeString = convertMinutesToHoursString(sessionMinutes);
	}

	// if this flow is triggered by ended by ping ToUser, and the userId of this session matches with FromUser.UserId of ping
	if (endSessionType == constants.endSessionTypes.endByPingToUserId && pingInfo && pingInfo.FromUser.dataValues.id == UserId) {
		// ended by someone else. user may or may not be in session
		
		const { pingId, FromUser, ToUser } = pingInfo;

		message = `Hey! <@${ToUser.dataValues.SlackName}> just finished their session`;
		if (pingInfo.endSessionType == constants.endSessionTypes.endSessionEarly) {
			message = `${message} early`;
		}

		if (pingInfo.session) {
			letsFocusMessage = `I ended your focused session on \`${session.dataValues.content}\`. ${letsFocusMessage}`;
		}

	} else if (session) { // session must exist for all endSessionTypes other than endByPingToUserId
		message = `Great work on \`${session.dataValues.content}\`! You were focused for *${sessionTimeString}*`;
	}

	convo.say(message); // this message is relevant to how session got ended (ex. sessionTimerUp vs endByPingToUserId)
	handleToUserPings(convo);
	handleFromUserPings(convo);

	convo.say({
		text: letsFocusMessage,
		attachments: letsFocusAttachments
	});

	convo.next();

}

// this handles messaging for all pings to user of ending session
function handleToUserPings(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingInfo, pingObjects }  = convo.sessionEnd;
	let message = ' ';

	let slackUserIds = [];
	pingObjects.toUser.forEach((pingObject) => {
		const { ping: { dataValues: { FromUser } } } = pingObject;
		if (!_.includes(slackUserIds, FromUser.dataValues.SlackUserId)) {
			slackUserIds.push(FromUser.dataValues.SlackUserId);
		}
	});

	let slackNamesString = commaSeparateOutStringArray(slackUserIds, { SlackUserIds: true });

	if (endSessionType == constants.endSessionTypes.endByPingToUserId && pingInfo && pingInfo.FromUser.dataValues.id == UserId && slackUserIds.length > 0) {

		message = `While you were heads down, ${slackNamesString} wanted to reach out to talk with you. I started conversations with each of them on your left, too!`;

	} else {

		if (slackUserIds.length == 1) {
			message = `While you were heads down, ${slackNamesString} asked me to send you a message after your session :relieved:`
		} else if (slackUserIds.length > 0) {
			message = `While you were heads down, you received messages from ${slackNamesString}`;
		}

	}

	convo.say(message);

	message = ' ';
	if (pingObjects.toUser.length == 1) {
		message = `:point_left: I just kicked off a conversation between you both`;
	} else if (pingObjects.toUser.length > 1) {
		message = `:point_left: I just kicked off separate conversations between you and each of them`;
	}

	convo.say(message);
	convo.next();

}

// this handles messaging for all pings by the user of ending session
function handleFromUserPings(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType, pingInfo, pingObjects }  = convo.sessionEnd;
	let message;

	pingObjects.fromUser.forEach((pingObject) => {
		const { ping, ping: { dataValues: { ToUser } }, session } = pingObject;

		if (session) {
			// if in session, give option to break focus
			const { dataValues: { content, endTime } } = session;
			const endTimeString = moment(endTime).tz(ToUser.dataValues.tz).format("h:mma");
			convo.say({
				text: `<@${ToUser.dataValues.SlackUserId}> is focusing on \`${content}\` until *${endTimeString}*. I'll send your message at that time, unless this is urgent and you want to send it now`,
				attachments: [
					{
						attachment_type: 'default',
						callback_id: "SEND_BOMB",
						fallback: "Let's send this now!",
						actions: [
							{
								name: buttonValues.sendNow.name,
								text: "Send now :bomb:",
								value: `{"sendBomb": true, "pingId": "${ping.dataValues.id}"}`,
								type: "button"
							}
						]
					}
				]
			});
		} else {
			// if not in session, trigger convo immediately
			convo.say(`<@${ToUser.dataValues.SlackUserId}> is not in a focused session, so I just started a conversation between you two :simple_smile:`);
		}
	});

}

/**
 * if FromUserId is not in session, immediately trigger convo
 * 		- let user know "hey! kevin just finished their session [early if end early]. i kicked off a convo"
 * 		
 * if FromUserId is in a session that is not superFocus, trigger end_session_flow for FromUserId. this needs config to handle "Hey! {username} just finished their session early. You asked me to let you know when {username} finished working so you could talk" instead of standard "`Great work on \`${content}\`! You were focused for *${sessionTimeString}*`"
 * 		ex. config.PingToUserIdSession = { endSessionTypes (endEarly or sessionTimerUp or endByPingToUserId // ended by the person you queued a ping to!)}
 * 		- this ends session. "Hey! kevin just finished their session early. You asked me to let you know when to talk. I ended your focus session..."
 * 		- if has pinged messages from other teammates, run same flow in `end_session_flow` (while you were heads down, chip wanted to talk to you!)
 *
 * if FromUserId is in a superFocus session, do not notify ToUserId at all
 * 		- check if endSession pings exist where FromUserId match this ended session's UserId
 * 		- If any exist, check if ToUserId is in session
 * 				- if ToUserId is not in session, start conversation right away
 * 		  	- If ToUserId is in a session, let the FromUserId know that "kevin is focusing on X until Y. ill plan on sending this to them at Y, unless you want to send now" (with bomb, send now option)
 *
 *
 * LOGIC NEEDED FOR...
 * 		- session end via session_timer_up, or via end_session_early
 */

