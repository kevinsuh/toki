import os from 'os';
import { wit } from '../../index';

import endWorkSessionController from './endWorkSession';
import middleWorkSessionController from './middleWorkSession';

// base controller for work sessions
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	middleWorkSessionController(controller);
	endWorkSessionController(controller);

};