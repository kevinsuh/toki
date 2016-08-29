import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString } from '../../lib/messageHelpers';

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

	// either no live session, or not in `superFocus`
	let pingObjectsToUser = pingObjects.toUser.filter(pingObject => !pingObject.session || !pingObject.session.dataValues.superFocus );
	convo.sessionEnd.pingObjects.toUser = pingObjectsToUser;

	let pingObjectsFromUser = pingObjects.fromUser.filter(pingObject => !pingObject.session || !pingObject.session.dataValues.superFocus );
	convo.sessionEnd.pingObjects.fromUser = pingObjectsFromUser;

	let message = `Great work on \`${content}\`! You were focused for *${sessionTimeString}*`;
	if (pingObjects.toUser.length == 1) {
		message = `${message}. While you were heads down, <@${pingObjects.toUser[0].session.dataValues.User.dataValues.SlackUserId}> asked me to send you a message after your session :relieved:`
	} else {
		let slackNames = [];
		pingObjects.toUser.forEach((pingObject) => {
			slackNames.push(pingObject.)
		});
	}

	convo.say();

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

