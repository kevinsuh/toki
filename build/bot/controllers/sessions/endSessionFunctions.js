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
  } else {
    var SlackNames = [];
    pingObjects.forEach();
  }

  convo.say();
}

/**
 * if FromUserId is not in session, immediately trigger convo
 * 		- let user know "hey! kevin just finished their session [early if end early]. i kicked off a convo"
 * 		
 * if FromUserId is in a session that is not superFocus, trigger end_session_flow for FromUserId. this needs config to handle "Hey! {username} just finished their session early. You asked me to let you know when {username} finished working so you could talk" instead of standard "`Great work on \`${content}\`! You were focused for *${sessionTimeString}*`"
 * 		ex. config.PingToUserIdSession = { doneSessionType (endEarly or sessionTimerUp or endByPingToUserId // ended by the person you queued a ping to!)}
 * 		- this ends session. "Hey! kevin just finished their session early. You asked me to let you know when to talk. I ended your focus session..."
 * 		- if has pinged messages from other teammates, run same flow in `end_session_flow` (while you were heads down, chip wanted to talk to you!)
 *
 * if FromUserId is in a superFocus session, do not notify ToUserId at all
 * 		- check if endSession pings exist where FromUserId match this ended session's UserId
 * 		- If any exist, check if ToUserId is in session
 * 				- if ToUserId is not in session, start conversation right away
 * 		  	- If ToUserId is in a session, let the FromUserId know that "kevin is focusing on X until Y. ill plan on sending this to them at Y, unless you want to send now" (with bomb, send now option)
 *
 *
 * LOGIC NEEDED FOR...
 * 		- session end via session_timer_up, or via end_session_early
 */
//# sourceMappingURL=endSessionFunctions.js.map