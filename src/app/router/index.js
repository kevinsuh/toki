import request from 'request';

// our various routes
import signup from './routes/signup';
import login from './routes/login';

// api calls
import api_tasks from '../api/v1/tasks';

export default (app) => {

  // root
  app.get('/', (req, res) => {
    res.render('root');
  });

  // web app
  app.use('/new', signup);
  app.use('/login', login);

  // api
  app.use('/api/v1/tasks', api_tasks);

}

