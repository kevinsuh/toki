'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.startEndSessionFlow = startEndSessionFlow;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		END SESSION CONVERSATION FLOW FUNCTIONS
 */

// confirm that user has tz configured before continuing
function startEndSessionFlow(convo) {
  var _convo$sessionEnd = convo.sessionEnd;
  var SlackUserId = _convo$sessionEnd.SlackUserId;
  var UserId = _convo$sessionEnd.UserId;
  var tz = _convo$sessionEnd.tz;
}
//# sourceMappingURL=endSessionFunctions.js.map