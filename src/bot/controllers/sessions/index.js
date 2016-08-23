import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';
import moment from 'moment-timezone';

import startSessionController from './startSession';
import endSessionController from './endSession';

// base controller for work sessions!
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startSessionController(controller);
	endSessionController(controller);

};