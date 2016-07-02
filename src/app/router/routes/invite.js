import request from 'request';
import express from 'express';

import dotenv from 'dotenv';

import invite from '../../lib/slack-invite';
import models from '../../models';

var router = express.Router();

// bring in helpers
import { getAuthAddress, startBot, saveUserOnLogin } from '../helpers';

// handle the API call after user inputs email
router.post('/', (req, res) => {

	const { email } = req.body;

	var env = process.env.NODE_ENV || 'development';
	if (env == 'development') {
		var org   = "heynavi";
		var token = process.env.DEV_TOKI_TOKEN;
	} else {
		var org   = "tokibot1";
		var token = process.env.TOKI_TOKEN_1;
	}

	invite({ token, org, email }, err => {
		if (err) {
			if (err.message === `Sending you to Slack...`) {
				res.redirect(`https://${org}.slack.com`);
			} else {
				res.redirect(`/?invite=true&success=false&msg=${err.message}`);
			}
			return;
		} else {
			models.User.create({
				email
			});
			res.redirect(`/?invite=true&success=true&msg=Yay! We sent an invite email to ${email}`);
		}
	});
});

export default router;