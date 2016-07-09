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

  // models.DailyTask.create({
  //   TaskId:98,
  //   priority: 1,
  //   minutes: 99,
  //   UserId: 1
  // }).then((dailyTask) => {

  console.log("\n\n\n testing moment timezone WITH PACIFIC TIME... \n\n\n");
  var pacificTime = "America/Los_Angeles";
  var time = "12:57:00.000";
  // "2016-06-24T16:24:00.000-04:00" format

  var now = moment.tz(pacificTime);
  console.log("right now in PST:");
  console.log(now.toString());
  var nowTime = now.format("HH:mm:ss");
  console.log(`now time: ${nowTime}`);
  console.log(`reminder time: ${time}`);
  if (time > nowTime) {
    console.log("reminder time is greater than now! this means we can just go with todays date to format");
    console.log(time);
    var nowDate = now.format("YYYY-MM-DD");
    var dateTimeFormat = `${nowDate} ${time}`;
    console.log("datetime format: ");
    console.log(dateTimeFormat);
    console.log("\n\n\n");
  } else {
    console.log("reminder time is less than now. must assume it is referring to next day...");
    var nextDate = now.add(1, 'days');
    nextDate = nextDate.format("YYYY-MM-DD");
    var dateTimeFormat = `${nextDate} ${time}`;
    console.log(time);
  }


  console.log("time given with PST");
  var nowWithTime = moment.tz(dateTimeFormat, pacificTime);
  console.log(nowWithTime.toString());
  
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