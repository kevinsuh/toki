import request from 'request';
import express from 'express';
import pg from 'pg';

var router = express.Router();

import { bot } from '../../../server';
import { controller } from '../../../bot/controllers';
import { seedDatabaseWithExistingSlackUsers } from '../../../bot/lib/slackApiHelpers';
import models from '../../models';

/**
 *    SLACK USERS CONTROLLER
 *    `/api/v1/slack_users`
 */

// index
router.get('/', (req, res) => {

  models.SlackUser.findAll({
  	include: [models.User]
  }).then((slackUsers) => {
    console.log(slackUsers);
    res.json(slackUsers);
  });
  seedDatabaseWithExistingSlackUsers(bot);
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