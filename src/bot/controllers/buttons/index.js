import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';
import moment from 'moment';

import models from '../../../app/models';

import { convertToSingleTaskObjectArray, convertArrayToTaskListMessage } from '../../lib/messageHelpers';

// base controller for "day" flow
export default function(controller) {
	
	/**
	* 	START OF YOUR DAY
	*/

	startDayFlowController(controller);
	endDayFlowController(controller);

};