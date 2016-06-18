'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
 * 	START OF YOUR DAY
 */

	(0, _startDay2.default)(controller);
	(0, _endDay2.default)(controller);
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _startDay = require('./startDay');

var _startDay2 = _interopRequireDefault(_startDay);

var _endDay = require('./endDay');

var _endDay2 = _interopRequireDefault(_endDay);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var FINISH_WORD = 'done';

// base controller for "day" flow
;
//# sourceMappingURL=index.js.map