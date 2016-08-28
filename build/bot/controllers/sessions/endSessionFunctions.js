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
	var session = _convo$sessionEnd.session;
	var pingObjects = _convo$sessionEnd.pingObjects;
	var tz = _convo$sessionEnd.tz;

	// session info

	var startTimeObject = (0, _momentTimezone2.default)(session.dataValues.startTime).tz(tz);
	var endTimeObject = (0, _momentTimezone2.default)(session.dataValues.endTime).tz(tz);
	var endTimeString = endTimeObject.format("h:mm a");
	var sessionMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(startTimeObject)).asMinutes());
	var sessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(sessionMinutes);
}
//# sourceMappingURL=endSessionFunctions.js.map