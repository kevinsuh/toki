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
 *    SLACK USERS CONTROLLER
 *    `/api/v1/slack_users`
 */

// index
router.get('/', (req, res) => {

  // 2016-06-13T13:55:00.000-04:00
  var timeEST = moment.tz("2016-06-13T13:55:00.000", "America/New_York");
  console.log("huh\n\n\n\n\n");

  console.log("\n\n\n\nEST:")
  console.log(timeEST.format("YYYY-MM-DD HH:mm:ss"));
  console.log(timeEST.utc().format("YYYY-MM-DD HH:mm:ss"));

  console.log("\n\n\n\nPST:")
  var timePST = moment.tz("2016-06-13T13:55:00.000", "America/Los_Angeles");
  console.log(timePST.format("YYYY-MM-DD HH:mm:ss"));
  console.log(timePST.utc().format("YYYY-MM-DD HH:mm:ss"));
  console.log("OKAY...\n\n\n\n")


  models.SlackUser.findAll({
  	include: [models.User]
  }).then((slackUsers) => {
    res.json(slackUsers);
  });
  // seedDatabaseWithExistingSlackUsers(bot);
  
});

// create
router.post('/', (req, res) => {
  
	const { UserId, SlackUserId } = req.body;

  models.SlackUser.create({
    SlackUserId,
    UserId
  }).then((slackUser) => {
    res.json(slackUser);
  });

});

// read
router.get('/:slack_user_id', (req, res) => {

	models.SlackUser.find({
		where: { SlackUserId: req.params.slack_user_id },
		include: [
			models.User
		]
	}).then((slackUser) => {
		res.json(slackUser);
	})

});

// update
router.put('/:slack_user_id', (req, res) => {
});

// delete
router.delete('/:slack_user_id', (req, res) => {
});

export default router;