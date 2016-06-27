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

var _controllers = require('../../../bot/controllers');

var _models = require('../../models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

/**
 *    USERS CONTROLLER
 *    `/api/v1/users`
 */

// index
router.get('/', function (req, res) {

  _models2.default.User.findAll({
    include: [_models2.default.SlackUser]
  }).then(function (users) {
    console.log(users);
    res.json(users);
  });
});

// create
router.post('/', function (req, res) {
  var _req$body = req.body;
  var email = _req$body.email;
  var SlackUserId = _req$body.SlackUserId;


  _models2.default.User.create({
    email: email
  }).then(function (user) {
    // create slack_user if it exists
    if (SlackUserId) {
      _models2.default.SlackUser.create({
        UserId: user.UserId,
        SlackUserId: SlackUserId
      }).then(function (slackUser) {
        var user = _models2.default.User.find({
          where: { id: slackUser.UserId },
          include: [_models2.default.SlackUser]
        });
        res.json(user);
      });
    } else {
      res.json(user);
    }
  });
});

// read
router.get('/:id', function (req, res) {
  var id = req.params.id;


  var user = _models2.default.User.find({
    where: { id: id },
    include: [_models2.default.SlackUser]
  }).then(function (user) {
    res.json(user);
  });
});

// update
router.put('/:id', function (req, res) {});

// delete
router.delete('/:id', function (req, res) {});;

exports.default = router;
//# sourceMappingURL=users.js.map