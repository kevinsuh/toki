import request from 'request';
import express from 'express';
import pg from 'pg';

import moment from 'moment-timezone';

var router = express.Router();

import { controller } from '../../../bot/controllers';

// sequelize models
import models from '../../models';

/**
 *    TASKS CONTROLLER
 *    `/api/v1/tasks`
 */

// index
router.get('/', (req, res) => {

  const SlackUserId = "U121ZK15J";
  var now = moment();
  models.WorkSession.findAll({
    where: [ `"endTime" < ?`, new Date() ],
    order: `"WorkSession"."createdAt" DESC`,
    include: [ models.DailyTask ],
    limit: 2
  }).then((workSessions) => {

    console.log(workSessions);
    return;

  });
  
  // find user then reply
 models.User.find({
  where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
  include: [
    models.SlackUser
  ]
})
 .then((user) => {
  console.log(user);
  res.json(user);
 })

});

// create
router.post('/', (req, res) => {

  // grab data from API request
  // done is defaulted to false w/ new tasks
  const { text, user_id } = req.body;

  // THIS IS A PASSING TEST FOR SEPARATION OF CONCERNS
  // We get the data we need from DB, then can trigger the controller to send the appropriate message to the appropriate person

  // userID for kevin
  // var userID = "U121ZK15J"; // DM ID: "D1F93BHM3"
  // controller.trigger('test_message_send', [bot, userID, `Here is your task: ${data.text}`]);

  models.Task.create({
    text: text,
    UserId: user_id
  }).then((task) => {
    res.json(task);
  })

});

// read
router.get('/:id', (req, res) => {
  const { id } = req.params;
  models.Task.find({
    where: {
      id
    }
  }).then((task) => {
    res.json(task);
  })
});

// update
router.put('/:id', (req, res) => {

  const { title, done } = req.body;
  const { id } = req.params;

  models.Task.find({
    where: {
      id
    }
  }).then((task) => {
    if (task) {
      task.updateAttributes( {
        title,
        done
      }).then((task) => {
        res.send(task);
      })
    }
  })

});

// delete
router.delete('/:id', (req, res) => {

  const { id } = req.params;

  models.Task.destroy({
    where: {
      id
    }
  }).then((task) => {
    res.json(task);
  })

});;

export default router;