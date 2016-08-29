import moment from 'moment-timezone';
import models from '../../../app/models';
import { utterances, colorsArray, buttonValues, colorsHash, constants } from '../../lib/constants';

import sendPingController from './sendPing';

// base controller for pings!
export default function(controller) {

	/**
	 * 		INDEX functions of pings
	 */
	sendPingController(controller);

};
