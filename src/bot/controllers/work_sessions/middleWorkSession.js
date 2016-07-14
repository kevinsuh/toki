import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';

import { resumeQueuedReachouts } from '../index';

// MIDDLE OF A WORK SESSION
export default function(controller) {

	/**
	 * 		DURING A WORK SESSION
	 *
	 * 		Options:
	 * 		1. extend work session
	 * 		2. cross out tasks
	 * 		3. ask how much time left
	 * 		
	 */

};