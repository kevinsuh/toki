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

var _helpers = require('../helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

// bring in helpers


// handle the API call after user inputs email
router.post('/', function (req, res) {
	var email = req.body.email;

	var org = "tokibot1";
	var token = process.env.TOKI_TOKEN_1;

	(0, _slackInvite2.default)({ token: token, org: org, email: email }, function (err) {
		if (err) {
			if (err.message === 'Sending you to Slack...') {
				res.redirect('https://' + org + '.slack.com');
			} else {
				res.redirect('/?invite=true&success=false&msg=' + err.message);
			}
			return;
		}
		res.redirect('/?invite=true&success=true&msg=Yay! We sent an invite email to ' + email);
	});
});

exports.default = router;
//# sourceMappingURL=invite.js.map