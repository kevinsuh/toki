import request from 'request';
import express from 'express';

import dotenv from 'dotenv';

import invite from '../../lib/slack-invite';

var router = express.Router();

// bring in helpers
import { getAuthAddress, startBot, saveUserOnLogin } from '../helpers';

// handle the API call after user inputs email
router.post('/', (req, res) => {

	const { email } = req.body;
	const org       = "tokibot1";
	const token     = process.env.TOKI_TOKEN_1;

	invite({ token, org, email }, err => {
		if (err) {
			if (err.message === `Sending you to Slack...`) {
				res.redirect(`https://${org}.slack.com`);
			} else {
				res.redirect(`/?invite=true&success=false&msg=${err.message}`);
			}
			return;
		}
		res.redirect(`/?invite=true&success=true&msg=Yay! We sent an invite email to ${email}`);
	});
});

export default router;