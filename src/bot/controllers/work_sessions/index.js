import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';
import moment from 'moment-timezone';

import endWorkSessionController from './endWorkSession';
import endWorkSessionTimeoutsController from './endWorkSessionTimeouts';
import startWorkSessionController from './startWorkSession';
import sessionOptionsController from './sessionOptions';

import intentConfig from '../../lib/intents';
import { hoursForExpirationTime, startDayExpirationTime, colorsArray, buttonValues, colorsHash, startSessionOptionsAttachments, pausedSessionOptionsAttachments, TASK_DECISION } from '../../lib/constants';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage, commaSeparateOutTaskArray, convertMinutesToHoursString, deleteConvoAskMessage, convertTaskNumberStringToArray } from '../../lib/messageHelpers';
import { utterances } from '../../lib/botResponses';

import { askUserPostSessionOptions, handlePostSessionDecision } from './endWorkSession';

import { resumeQueuedReachouts } from '../index';

// base controller for work sessions!
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startWorkSessionController(controller);
	sessionOptionsController(controller);
	endWorkSessionController(controller);
	endWorkSessionTimeoutsController(controller);

};