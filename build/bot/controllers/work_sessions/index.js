'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * 		INDEX functions of work sessions
  */

	(0, _startWorkSession2.default)(controller);
	(0, _sessionOptions2.default)(controller);
	(0, _endWorkSession2.default)(controller);
	(0, _endWorkSessionTimeouts2.default)(controller);
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _endWorkSession = require('./endWorkSession');

var _endWorkSession2 = _interopRequireDefault(_endWorkSession);

var _endWorkSessionTimeouts = require('./endWorkSessionTimeouts');

var _endWorkSessionTimeouts2 = _interopRequireDefault(_endWorkSessionTimeouts);

var _startWorkSession = require('./startWorkSession');

var _startWorkSession2 = _interopRequireDefault(_startWorkSession);

var _sessionOptions = require('./sessionOptions');

var _sessionOptions2 = _interopRequireDefault(_sessionOptions);

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _botResponses = require('../../lib/botResponses');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for work sessions!
//# sourceMappingURL=index.js.map