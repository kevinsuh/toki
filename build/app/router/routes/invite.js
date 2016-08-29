'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _slackInvite = require('../../lib/slack-invite');

var _slackInvite2 = _interopRequireDefault(_slackInvite);

var _models = require('../../models');

var _models2 = _interopRequireDefault(_models);

var _helpers = require('../helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

// bring in helpers


// handle the API call after user inputs email
router.post('/', function (req, res) {
	var email = req.body.email;


	_models2.default.BetaList.create({
		email: email
	}).then(function (betaList) {
		var success = betaList ? true : false;
		res.redirect('/?success=' + success + '&email=' + email);
	});
});

exports.default = router;
//# sourceMappingURL=invite.js.map