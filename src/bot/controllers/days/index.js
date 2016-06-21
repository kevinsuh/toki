import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';
import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

import startDayFlowController from './startDay';
import endDayFlowController from './endDay';

// base controller for "day" flow
export default function(controller) {
	
	/**
	* 	START OF YOUR DAY
	*/

	startDayFlowController(controller);
	endDayFlowController(controller);

};