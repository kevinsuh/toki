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

	models.BetaList.create({
		email
	})
	.then((betaList) => {
		let success = betaList ? true : false;
		res.redirect(`/?success=${success}&email=${email}`);
	})

});

export default router;