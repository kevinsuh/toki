'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

// our various routes (they are essentially controllers)


// sequelize models


// react!


var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _signup = require('./routes/signup');

var _signup2 = _interopRequireDefault(_signup);

var _login = require('./routes/login');

var _login2 = _interopRequireDefault(_login);

var _invite = require('./routes/invite');

var _invite2 = _interopRequireDefault(_invite);

var _models = require('../models');

var _models2 = _interopRequireDefault(_models);

var _slack = require('../lib/slack');

var _slack2 = _interopRequireDefault(_slack);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _components = require('../client/components');

var _components2 = _interopRequireDefault(_components);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (app) {

	app.get('/', function (req, res) {

		var env = process.env.NODE_ENV || 'development';
		if (env == 'development') {
			process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
			process.env.SLACK_ID = process.env.DEV_SLACK_ID;
			process.env.SLACK_SECRET = process.env.DEV_SLACK_SECRET;
		}

		var reactHtml = _react2.default.renderToString((0, _components2.default)({}));
		console.log('\n\n hello world!?!?\n\n');
		console.log(reactHtml);

		var variables = _extends({}, req.query, {
			env: env,
			reactOutput: "hi"
		});

		res.render('pages/index', variables);
	});

	app.use('/invite', _invite2.default);

	// web app
	app.use('/new', _signup2.default);
	app.use('/login', _login2.default);
};
//# sourceMappingURL=index.js.map