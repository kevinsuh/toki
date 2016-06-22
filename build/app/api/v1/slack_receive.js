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

var _server = require('../../../server');

var _controllers = require('../../../bot/controllers');

var _slackApiHelpers = require('../../../bot/lib/slackApiHelpers');

var _models = require('../../models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

/**
 *    SLACK RECEIVES CONTROLLER
 *    `/api/v1/slack_receive`
 */

// index
router.get('/', function (req, res) {

  res.json({ "hello": "world" });
});

// create
router.post('/', function (req, res) {

  console.log("\n\n\n ~~~ BUTTON POSTS IN HERE /api/v1/slack_receive ~~~ \n\n\n");
});

exports.default = router;
//# sourceMappingURL=slack_receive.js.map