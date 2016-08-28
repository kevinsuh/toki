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
	var tz = _convo$sessionEnd.tz;
	var pingObjects = convo.sessionEnd.pingObjects; // this will get trimmed ton only final pingObjects

	var _session$dataValues = session.dataValues;
	var content = _session$dataValues.content;
	var startTime = _session$dataValues.startTime;
	var endTime = _session$dataValues.endTime;

	// session info

	var startTimeObject = (0, _momentTimezone2.default)(startTime).tz(tz);
	var endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
	var endTimeString = endTimeObject.format("h:mm a");
	var sessionMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(startTimeObject)).asMinutes());
	var sessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(sessionMinutes);

	// either no live session, or not in `superFocus`
	pingObjects = pingObjects.filter(function (pingObject) {
		return !pingObject.session || !pingObject.session.dataValues.superFocus;
	});
	convo.sessionEnd.pingObjects = pingObjects;

	var message = 'Great work on `' + content + '`! You were focused for *' + sessionTimeString + '*';
	if (pingObjects.length == 1) {
		message = message + '. While you were heads down, <@' + pingObjects[0].session.dataValues.User.dataValues.SlackUserId + '> asked me to send you a message after your session :relieved:';
	} else {}

	convo.say();
}
//# sourceMappingURL=endSessionFunctions.js.map