import request from 'request';
import { controller as slack } from '../controllers';

import signup from './routes/signup';
import login from './routes/login';

export default (app) => {

  /**
   *    PUBLIC PAGES
   */
  // root
  app.get('/', (req, res) => {
    res.render('root');
  });

  app.use('/new', signup);
  app.use('/login', login);

}

