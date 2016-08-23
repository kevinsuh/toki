'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

// our various routes


// sequelize models


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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (app) {

	var org = "tokibot1";
	var interval = 5000;
	var token = process.env.TOKI_TOKEN_1;

	// fetch data
	var slack = new _slack2.default({ token: token, interval: interval, org: org });
	slack.setMaxListeners(Infinity);

	app.use(function (req, res, next) {
		if (slack.ready) return next();
		slack.once('ready', next);
	});

	// root
	app.get('/', function (req, res) {
		var org = "tokibot1";
		var variables = _extends({}, req.query, {
			org: org
		});
		res.render('root', variables);
	});

	app.use('/invite', _invite2.default);

	// web app
	app.use('/new', _signup2.default);
	app.use('/login', _login2.default);
};
//# sourceMappingURL=index.js.map