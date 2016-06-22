import request from 'request';
import express from 'express';
import pg from 'pg';
import moment from 'moment-timezone';

var router = express.Router();

import { bot } from '../../../server';
import { controller } from '../../../bot/controllers';
import { getTimeZoneOffsetForUser, seedDatabaseWithExistingSlackUsers } from '../../../bot/lib/slackApiHelpers';
import models from '../../models';

/**
 *    SLACK RECEIVES CONTROLLER
 *    `/api/v1/slack_receive`
 */

// index
router.get('/', (req, res) => {

	res.json({"hello":"world"});

})

// create
router.post('/', (req, res) => {
  
	console.log("\n\n\n ~~~ BUTTON POSTS IN HERE /api/v1/slack_receive ~~~ \n\n\n");

	

});

export default router;