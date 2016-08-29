import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments, letsFocusAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString, commaSeparateOutStringArray } from '../../lib/messageHelpers';

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
export function startEndSessionFlow(convo) {

	const { SlackUserId, UserId, session, tz, endSessionType }  = convo.sessionEnd;
	let { pingObjects } = convo.sessionEnd; // this will get trimmed ton only final pingObjects

	const { dataValues: { content, startTime, endTime } } = session;

	// session info
	const startTimeObject   = moment(startTime).tz(tz);
	const endTimeObject     = moment(endTime).tz(tz);
	const endTimeString     = endTimeObject.format("h:mm a");
	const sessionMinutes    = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
	const sessionTimeString = convertMinutesToHoursString(sessionMinutes);

	let message = `Great work on \`${content}\`! You were focused for *${sessionTimeString}*`;

	/**
	 * 	THIS HANDLES WHEN USER IS TOUSER PING
	 */
	if (pingObjects.toUser.length == 1) {
		message = `${message}. While you were heads down, <@${pingObjects.toUser[0].session.dataValues.User.dataValues.SlackUserId}> asked me to send you a message after your session :relieved:`
	} else {
		let slackUserIds = [];
		pingObjects.toUser.forEach((pingObject) => {
			const { ping, session } = pingObject;
			slackUserIds.push(ping.dataValues.FromUser.dataValues.SlackUserId);
		});
		let slackNamesString = commaSeparateOutStringArray(slackUserIds, { SlackUserIds: true });
		message = `${message}. While you were heads down, you received messages from ${slackNamesString}`;
	}

	convo.say(message);

	if (pingObjects.toUser.length == 1) {
		convo.say(`:point_left: I just kicked off a conversation between you both`);
	} else if (pingObjects.toUser.length > 1) {
		convo.say(`:point_left: I just kicked off separate conversations between you and each of them`);
	}

	/**
	 * 	THIS HANDLES WHEN USER IS FROMUSER PING
	 */
	pingObjects.fromUser.forEach((pingObject) => {
		const { ping, ping: { dataValues: { ToUser } }, session } = pingObject;

		if (session) {
			// if in session, give option to break focus
			const { dataValues: { content, endTime } } = session;
			const endTimeString = moment(endTime).tz(ToUser.dataValues.tz).format("h:mma");
			convo.say({
				text: `<@${ToUser.dataValues.SlackUserId}> is focusing on \`${content}\` until *${endTimeString}*. I'll send your message then, unless you tell me this is urgent and want to send it now`,
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
		
	})

	convo.say({
		text: `When you’re ready, let me know when you’d like to focus again`,
		attachments: letsFocusAttachments
	});

	convo.next();

}

/**
 * if FromUserId is not in session, immediately trigger convo
 * 		- let user know "hey! kevin just finished their session [early if end early]. i kicked off a convo"
 * 		
 * if FromUserId is in a session that is not superFocus, trigger end_session_flow for FromUserId. this needs config to handle "Hey! {username} just finished their session early. You asked me to let you know when {username} finished working so you could talk" instead of standard "`Great work on \`${content}\`! You were focused for *${sessionTimeString}*`"
 * 		ex. config.PingToUserIdSession = { doneSessionType (endEarly or sessionTimerUp or endByPingToUserId // ended by the person you queued a ping to!)}
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

