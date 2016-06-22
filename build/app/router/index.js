'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _signup = require('./routes/signup');

var _signup2 = _interopRequireDefault(_signup);

var _login = require('./routes/login');

var _login2 = _interopRequireDefault(_login);

var _tasks = require('../api/v1/tasks');

var _tasks2 = _interopRequireDefault(_tasks);

var _users = require('../api/v1/users');

var _users2 = _interopRequireDefault(_users);

var _slack_users = require('../api/v1/slack_users');

var _slack_users2 = _interopRequireDefault(_slack_users);

var _slack_receive = require('../api/v1/slack_receive');

var _slack_receive2 = _interopRequireDefault(_slack_receive);

var _models = require('../models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (app) {

  // root
  app.get('/', function (req, res) {
    res.render('root');
  });

  // web app
  app.use('/new', _signup2.default);
  app.use('/login', _login2.default);

  // api
  app.use('/api/v1/tasks', _tasks2.default);
  app.use('/api/v1/users', _users2.default);
  app.use('/api/v1/slack_users', _slack_users2.default);

  // app.use('/slack/receive', api_slack_receive)
};

// sequelize models


// api calls


// our various routes
//# sourceMappingURL=index.js.map