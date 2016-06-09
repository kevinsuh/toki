import request from 'request';

// our various routes
import signup from './routes/signup';
import login from './routes/login';

export default (app) => {

  // root
  app.get('/', (req, res) => {
    res.render('root');
  });

  app.use('/new', signup);
  app.use('/login', login);

}

