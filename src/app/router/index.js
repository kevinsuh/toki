import request from 'request';
import dotenv from 'dotenv';

// our various routes (they are essentially controllers)
import signup from './routes/signup';
import login from './routes/login';
import invite from './routes/invite';

// sequelize models
import models from '../models';
import Slack from '../lib/slack';

export default (app) => {

	app.get('/', (req, res) => {

		let env = process.env.NODE_ENV || 'development';
		if (env == 'development') {
			process.env.SLACK_ID = process.env.DEV_SLACK_ID;
			process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
		}

		let variables = {
			...req.query,
			env
		}

		res.render('root', variables);
	});

	app.get('/privacy', (req, res) => {
		res.render('privacy');
	})

	app.use('/invite', invite);

	// web app
	app.use('/new', signup);
	app.use('/login', login);

}

