import request from 'request';
import dotenv from 'dotenv';

// our various routes
import signup from './routes/signup';
import login from './routes/login';
import invite from './routes/invite';

// api calls
import api_tasks from '../api/v1/tasks';
import api_users from '../api/v1/users';
import api_slack_users from '../api/v1/slack_users';

// sequelize models
import models from '../models';

import Slack from '../lib/slack';

export default (app) => {

	var org      = "tokibot1";
	var interval = 5000;
	var token    = process.env.TOKI_TOKEN_1;

	// fetch data
	let slack = new Slack({ token, interval, org });
	slack.setMaxListeners(Infinity);

	app.use((req, res, next) => {
		console.log("\n\n ~~ slack is ready ~~ \n\n");
		console.log(req.body);
		console.log("\n\n\n");
    if (slack.ready) return next()
    slack.once('ready', next)
  });

	// root
	app.get('/', (req, res) => {
		var org = "tokibot1";
		res.render('root', { org });
	});

	app.use('/invite', invite);

	// web app
	app.use('/new', signup);
	app.use('/login', login);

	// api
	app.use('/api/v1/tasks', api_tasks);
	app.use('/api/v1/users', api_users);
	app.use('/api/v1/slack_users', api_slack_users);

}

