import request from 'request';
import express from 'express';
import pg from 'pg';

var router = express.Router();

import { dbConnectionString } from '../../config';
import { bot } from '../../../server';
import { controller } from '../../../bot/controllers';

// sequelize models
import models from '../../models';

/**
 *    TASKS CONTROLLER
 *    `/api/v1/tasks`
 */

// index
router.get('/', (req, res) => {

  models.Task.findAll({}).then((tasks) => {
    res.json(tasks);
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