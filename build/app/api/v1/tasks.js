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

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _server = require('../../../server');

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

  // models.DailyTask.create({
  //   TaskId:98,
  //   priority: 1,
  //   minutes: 99,
  //   UserId: 1
  // }).then((dailyTask) => {

  //   res.json(dailyTask);
  // })

  _models2.default.DailyTask.find({
    where: { id: 115 }
  }).then(function (dailyTask) {
    console.log("daily task time from DB... should be in UTC w/ offset");
    var time = (0, _moment2.default)(dailyTask.createdAt).toString();
    console.log(time);

    console.log("UTC TIME:");
    console.log(_moment2.default.utc("2016-06-24 22:34:55.935").tz("America/Indiana/Indianapolis").toString());
    res.json(dailyTask);
  });

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