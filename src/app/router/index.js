import request from 'request';
import dotenv from 'dotenv';

// our various routes
import signup from './routes/signup';
import login from './routes/login';
import invite from './routes/invite';

// sequelize models
import models from '../models';
import Slack from '../lib/slack';

export default (app) => {

	var org      = "tokibot1";
	var interval = 5000;

	// root
	app.get('/', (req, res) => {

		let env = process.env.NODE_ENV || 'development';
		if (env == 'development') {
			process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
			process.env.SLACK_ID = process.env.DEV_SLACK_ID;
			process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
		}

		var variables = {
			...req.query,
			env
		}
		res.render('root', variables);
	});

	app.use('/invite', invite);

	// web app
	app.use('/new', signup);
	app.use('/login', login);

}

