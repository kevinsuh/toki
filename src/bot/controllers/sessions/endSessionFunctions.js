import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString } from '../../lib/messageHelpers';

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
export function startEndSessionFlow(convo) {

	const { SlackUserId, UserId, session, tz }  = convo.sessionEnd;
	let { pingObjects } = convo.sessionEnd; // this will get trimmed ton only final pingObjects

	const { dataValues: { content, startTime, endTime } } = session;

	// session info
	const startTimeObject   = moment(startTime).tz(tz);
	const endTimeObject     = moment(endTime).tz(tz);
	const endTimeString     = endTimeObject.format("h:mm a");
	const sessionMinutes    = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
	const sessionTimeString = convertMinutesToHoursString(sessionMinutes);

	// either no live session, or not in `superFocus`
	pingObjects = pingObjects.filter(pingObject => !pingObject.session || !pingObject.session.dataValues.superFocus );
	convo.sessionEnd.pingObjects = pingObjects;

	let message = `Great work on \`${content}\`! You were focused for *${sessionTimeString}*`;
	if (pingObjects.length == 1) {
		message = `${message}. While you were heads down, <@${pingObjects[0].session.dataValues.User.dataValues.SlackUserId}> asked me to send you a message after your session :relieved:`
	} else {

	}

	convo.say();

}


