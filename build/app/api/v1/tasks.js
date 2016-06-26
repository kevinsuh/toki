'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _pg = require('pg');

var _pg2 = _interopRequireDefault(_pg);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _controllers = require('../../../bot/controllers');

var _models = require('../../models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

// sequelize models


/**
 *    TASKS CONTROLLER
 *    `/api/v1/tasks`
 */

// index
router.get('/', function (req, res) {

  var SlackUserId = "U121ZK15J";

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

  var now = _momentTimezone2.default.tz(pacificTime);
  console.log("right now in PST:");
  console.log(now.toString());
  var nowTime = now.format("HH:mm:ss");
  console.log('now time: ' + nowTime);
  console.log('reminder time: ' + time);
  if (time > nowTime) {
    console.log("reminder time is greater than now! this means we can just go with todays date to format");
    console.log(time);
    var nowDate = now.format("YYYY-MM-DD");
    var dateTimeFormat = nowDate + ' ' + time;
    console.log("datetime format: ");
    console.log(dateTimeFormat);
    console.log("\n\n\n");
  } else {
    console.log("reminder time is less than now. must assume it is referring to next day...");
    var nextDate = now.add(1, 'days');
    nextDate = nextDate.format("YYYY-MM-DD");
    var dateTimeFormat = nextDate + ' ' + time;
    console.log(time);
  }

  console.log("time given with PST");
  var nowWithTime = _momentTimezone2.default.tz(dateTimeFormat, pacificTime);
  console.log(nowWithTime.toString());

  // find user then reply
  _models2.default.User.find({
    where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
    include: [_models2.default.SlackUser]
  }).then(function (user) {
    console.log(user);
    res.json(user);
  });

  //   res.json(dailyTask);
  // })

  // models.DailyTask.find({
  //   where: { id: 115 }
  // }).then((dailyTask) => {
  //   console.log("daily task time from DB... should be in UTC w/ offset");
  //   var time = moment(dailyTask.createdAt).toString();
  //   console.log(time);

  //   console.log("UTC TIME:");
  //   console.log(moment.utc("2016-06-24 22:34:55.935").tz("America/Indiana/Indianapolis").toString())
  //   res.json(dailyTask);
  // })

  // this lets me test creating daily tasks on server

  // const data = {
  //   text: "test task name",
  //   minutes: 50,
  //   priority: 1,
  //   UserId: 1
  // }

  // models.Task.create({
  //   text: data.text,
  //   UserId: data.UserId
  // }).then((task) => {
  //   models.DailyTask.create({
  //     TaskId: task.id,
  //     priority: data.priority,
  //     minutes: data.minutes
  //   });
  // });

  // models.DailyTask.findAll({
  //   include: [
  //     models.Task
  //   ]
  // }).then((dailyTasks) => {
  //   res.json(dailyTasks);
  // });

  // models.Task.findAll({}).then((tasks) => {
  //   res.json(tasks);
  // })
});

// create
router.post('/', function (req, res) {

  // grab data from API request
  // done is defaulted to false w/ new tasks
  var _req$body = req.body;
  var text = _req$body.text;
  var user_id = _req$body.user_id;

  // THIS IS A PASSING TEST FOR SEPARATION OF CONCERNS
  // We get the data we need from DB, then can trigger the controller to send the appropriate message to the appropriate person

  // userID for kevin
  // var userID = "U121ZK15J"; // DM ID: "D1F93BHM3"
  // controller.trigger('test_message_send', [bot, userID, `Here is your task: ${data.text}`]);

  _models2.default.Task.create({
    text: text,
    UserId: user_id
  }).then(function (task) {
    res.json(task);
  });
});

// read
router.get('/:id', function (req, res) {
  var id = req.params.id;

  _models2.default.Task.find({
    where: {
      id: id
    }
  }).then(function (task) {
    res.json(task);
  });
});

// update
router.put('/:id', function (req, res) {
  var _req$body2 = req.body;
  var title = _req$body2.title;
  var done = _req$body2.done;
  var id = req.params.id;


  _models2.default.Task.find({
    where: {
      id: id
    }
  }).then(function (task) {
    if (task) {
      task.updateAttributes({
        title: title,
        done: done
      }).then(function (task) {
        res.send(task);
      });
    }
  });
});

// delete
router.delete('/:id', function (req, res) {
  var id = req.params.id;


  _models2.default.Task.destroy({
    where: {
      id: id
    }
  }).then(function (task) {
    res.json(task);
  });
});;

exports.default = router;
//# sourceMappingURL=tasks.js.map