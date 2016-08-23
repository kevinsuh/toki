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
	var token    = process.env.TOKI_TOKEN_1;

	// fetch data
	let slack = new Slack({ token, interval, org });
	slack.setMaxListeners(Infinity);

	app.use((req, res, next) => {
    if (slack.ready) return next()
    slack.once('ready', next)
  });

	// root
	app.get('/', (req, res) => {
		var org = "tokibot1";
		var variables = {
			...req.query,
			org
		}
		res.render('root', variables);
	});

	app.use('/invite', invite);

	// web app
	app.use('/new', signup);
	app.use('/login', login);

}

