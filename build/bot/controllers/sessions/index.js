'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * 		INDEX functions of work sessions
  */

	(0, _startSession2.default)(controller);
	(0, _endSession2.default)(controller);
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _startSession = require('./startSession');

var _startSession2 = _interopRequireDefault(_startSession);

var _endSession = require('./endSession');

var _endSession2 = _interopRequireDefault(_endSession);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// base controller for work sessions!
//# sourceMappingURL=index.js.map