import os from 'os';
import { wit } from '../../index';

import endWorkSessionController from './endWorkSession';
import middleWorkSessionController from './middleWorkSession';
import startWorKSessionController from './startWorKSession';

// base controller for work sessions
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startWorKSessionController(controller);
	middleWorkSessionController(controller);
	endWorkSessionController(controller);

};