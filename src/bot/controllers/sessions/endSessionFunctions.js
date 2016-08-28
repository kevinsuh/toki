import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString } from '../../lib/messageHelpers';

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
export function startEndSessionFlow(convo) {

	const { SlackUserId, UserId, session, pingObjects, tz }  = convo.sessionEnd;

	// session info
	const startTimeObject   = moment(session.dataValues.startTime).tz(tz);
	const endTimeObject     = moment(session.dataValues.endTime).tz(tz);
	const endTimeString     = endTimeObject.format("h:mm a");
	const sessionMinutes    = Math.round(moment.duration(endTimeObject.diff(startTimeObject)).asMinutes());
	const sessionTimeString = convertMinutesToHoursString(sessionMinutes);

}


