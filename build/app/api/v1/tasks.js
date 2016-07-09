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
  var now = (0, _momentTimezone2.default)();
  _models2.default.WorkSession.findAll({
    where: ['"endTime" < ?', new Date()],
    order: '"WorkSession"."createdAt" DESC',
    include: [_models2.default.DailyTask],
    limit: 2
  }).then(function (workSessions) {

    console.log(workSessions);
    return;
  });

  // find user then reply
  _models2.default.User.find({
    where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
    include: [_models2.default.SlackUser]
  }).then(function (user) {
    console.log(user);
    res.json(user);
  });
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