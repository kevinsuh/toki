'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _helpers = require('../helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

// bring in helpers


// handle the API call after user inputs email
router.post('/invite', function (req, res) {

  console.log("STARTING INVITE...");

  console.log(req.body);

  res.redirect('/');
});

exports.default = router;
//# sourceMappingURL=invite.js.map