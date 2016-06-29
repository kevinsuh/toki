import request from 'request';

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

export default (app) => {

	// root
	app.get('/', (req, res) => {
		res.render('root');
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

