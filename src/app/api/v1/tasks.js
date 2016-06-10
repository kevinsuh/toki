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

  // make connect for call
  pg.connect(dbConnectionString, (err, client, done) => {

    if (err) {
      done();
      console.log(err);
      return res.status(500).json({ success: false, data: err});
    }

    return returnTasks(client, res);

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
  models.Task.find({
    where: {
      id: req.params.id
    }
  }).then((task) => {
    res.json(task);
  })
});

// update
router.put('/:id', (req, res) => {
});

// delete
router.delete('/:id', (req, res) => {
});;

var returnTasks = (client, res) => {

  var results = [];

  // make SQL call
  var query = client.query("SELECT * FROM tasks ORDER by id ASC");

  // read in data through buffer
  query.on('row', (row) => {
    results.push(row);
  })

  // return in JSON format when done
  query.on('end', ()=> {
    return res.json(results);
  });

}


export default router;