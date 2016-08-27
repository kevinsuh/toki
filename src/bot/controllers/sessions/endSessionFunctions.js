import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash, timeZones, timeZoneAttachments } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, convertMinutesToHoursString } from '../../lib/messageHelpers';

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
export function startEndSessionFlow(convo) {

	const { SlackUserId, UserId, tz }  = convo.sessionEnd;

	

}


