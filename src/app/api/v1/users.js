import request from 'request';
import express from 'express';
import pg from 'pg';

var router = express.Router();

import { bot } from '../../../server';
import { controller } from '../../../bot/controllers';
import models from '../../models';

/**
 *    USERS CONTROLLER
 *    `/api/v1/users`
 */

// index
router.get('/', (req, res) => {

  models.User.findAll({
    include: [models.SlackUser]
  }).then((users) => {
    console.log(users);
    res.json(users);
  });

});

// create
router.post('/', (req, res) => {

  const { email, SlackUserId } = req.body;
  
  models.User.create({
    email
  }).then((user) => {
    // create slack_user if it exists
    if (SlackUserId) {
      models.SlackUser.create({
        UserId: user.UserId,
        SlackUserId
      }).then((slackUser) => {
        var user = models.User.find({
          where: { id: slackUser.UserId },
          include: [
            models.SlackUser
          ]
        });
        res.json(user);
      })
    } else {
      res.json(user);
    }
  });

});

// read
router.get('/:id', (req, res) => {

  const { id } = req.params;

  var user = models.User.find({
    where: { id },
    include: [
      models.SlackUser
    ]
  }).then((user) => {
    res.json(user); 
  });
  
});

// update
router.put('/:id', (req, res) => {
});

// delete
router.delete('/:id', (req, res) => {
});;

export default router;