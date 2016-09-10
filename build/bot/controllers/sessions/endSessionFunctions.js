'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startEndSessionFlow = startEndSessionFlow;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

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
	var endSessionType = _convo$sessionEnd.endSessionType;
	var pingContainers = _convo$sessionEnd.pingContainers;
	var pingInfo = _convo$sessionEnd.pingInfo;
	var mutualSessionEndingPings = _convo$sessionEnd.mutualSessionEndingPings;


	var startTimeObject = void 0;
	var endTimeObject = void 0;
	var endTimeString = void 0;
	var sessionMinutes = void 0;
	var sessionTimeString = void 0;
	var message = ' ';
	var letsFocusMessage = 'Let me know when you want to `/focus` again';

	// add session info (the one that just got ended) if existing
	// this is not the case when you have queued ping
	// and other user is done w/ session
	if (session) {
		var _session$dataValues = session.dataValues;
		var content = _session$dataValues.content;
		var startTime = _session$dataValues.startTime;
		var endTime = _session$dataValues.endTime;

		startTimeObject = (0, _momentTimezone2.default)(startTime).tz(tz);
		endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
		endTimeString = endTimeObject.format("h:mm a");
		sessionMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(startTimeObject)).asMinutes());
		sessionTimeString = (0, _messageHelpers.convertMinutesToHoursString)(sessionMinutes);
	}

	if (mutualSessionEndingPings && !_lodash2.default.isEmpty(mutualSessionEndingPings)) {

		// ping ends both sessions together

		var fromSessionEndingUser = mutualSessionEndingPings.fromSessionEndingUser;
		var fromSessionEndingUserPings = mutualSessionEndingPings.fromSessionEndingUserPings;
		var toSessionEndingUser = mutualSessionEndingPings.toSessionEndingUser;
		var toSessionEndingUserPings = mutualSessionEndingPings.toSessionEndingUserPings;

		// this is the user who ended the session!

		if (fromSessionEndingUser && fromSessionEndingUser.dataValues.SlackUserId == SlackUserId) {

			message = 'While you were heads down, you and <@' + toSessionEndingUser.dataValues.SlackUserId + '> wanted to send a message to each other';
		} else if (toSessionEndingUser && toSessionEndingUser.dataValues.SlackUserId == SlackUserId) {

			message = 'Hey! <@' + fromSessionEndingUser.dataValues.SlackUserId + '> finished their session';
			if (pingInfo.endSessionType == _constants.constants.endSessionTypes.endSessionEarly) {
				message = message + ' early';
			}
			message = message + ', and you two wanted to send a message to each other';
		}

		message = message + '\n:point_left: I just kicked off a conversation between you two';

		if (pingInfo && pingInfo.session) {
			letsFocusMessage = 'I ended your current focus on `' + session.dataValues.content + '`. ' + letsFocusMessage;
		}
	} else if (endSessionType == _constants.constants.endSessionTypes.endByPingToUserId && pingInfo && pingInfo.FromUser.dataValues.id == UserId) {

		// just a one-way ended by session end

		var FromUser = pingInfo.FromUser;
		var ToUser = pingInfo.ToUser;


		message = 'Hey! <@' + ToUser.dataValues.SlackUserId + '> finished their session';
		if (pingInfo.endSessionType == _constants.constants.endSessionTypes.endSessionEarly) {
			message = message + ' early';
		}
		message = message + '\n:point_left: I just kicked off a conversation between you two';

		if (pingInfo.session) {
			letsFocusMessage = 'I ended your current focus on `' + session.dataValues.content + '`. ' + letsFocusMessage;
		}
	} else if (session) {
		// session must exist for all endSessionTypes other than endByPingToUserId
		message = 'Great work on `' + session.dataValues.content + '`! You spent *' + sessionTimeString + '* on this';
	}

	convo.say(message);
	handleToUserPings(convo);
	handleFromUserPings(convo);

	convo.say({
		text: letsFocusMessage
	});

	convo.next();
}

// this handles messaging for all pings to user of ending session
function handleToUserPings(convo) {
	var _convo$sessionEnd2 = convo.sessionEnd;
	var SlackUserId = _convo$sessionEnd2.SlackUserId;
	var UserId = _convo$sessionEnd2.UserId;
	var session = _convo$sessionEnd2.session;
	var tz = _convo$sessionEnd2.tz;
	var endSessionType = _convo$sessionEnd2.endSessionType;
	var pingInfo = _convo$sessionEnd2.pingInfo;
	var pingContainers = _convo$sessionEnd2.pingContainers;


	var slackUserIds = [];
	for (var fromUserId in pingContainers.toUser.fromUser) {

		if (!pingContainers.toUser.fromUser.hasOwnProperty(fromUserId)) {
			continue;
		}

		var pingContainer = pingContainers.toUser.fromUser[fromUserId];
		var FromUser = pingContainer.user;

		// do not include the user who ended session together
		if (pingInfo && pingInfo.thisPingEndedUsersSessionsTogether && pingInfo.FromUser.dataValues.SlackUserId == FromUser.dataValues.SlackUserId) {
			continue;
		}

		if (!_lodash2.default.includes(slackUserIds, FromUser.dataValues.SlackUserId)) {
			slackUserIds.push(FromUser.dataValues.SlackUserId);
		}
	}

	if (slackUserIds.length > 0) {

		var message = void 0;

		var slackNamesString = (0, _messageHelpers.commaSeparateOutStringArray)(slackUserIds, { SlackUserIds: true });

		if (slackUserIds.length == 1) {
			message = 'While you were heads down, ' + slackNamesString + ' asked me to send you a message after your session :relieved:\n:point_left: I just kicked off a conversation between you both';
		} else {
			// > 1
			message = 'While you were heads down, you received messages from ' + slackNamesString + '\n:point_left: I just kicked off separate conversations between you and each of them';
		}

		convo.say(message);
	}

	convo.next();
}

// this handles messaging for all pings by the user of ending session
function handleFromUserPings(convo) {
	var _convo$sessionEnd3 = convo.sessionEnd;
	var SlackUserId = _convo$sessionEnd3.SlackUserId;
	var UserId = _convo$sessionEnd3.UserId;
	var session = _convo$sessionEnd3.session;
	var tz = _convo$sessionEnd3.tz;
	var endSessionType = _convo$sessionEnd3.endSessionType;
	var pingInfo = _convo$sessionEnd3.pingInfo;
	var pingContainers = _convo$sessionEnd3.pingContainers;

	var message = void 0;

	// `UserId` == `fromUserId` because it is this user who is ending session
	for (var toUserId in pingContainers.fromUser.toUser) {

		if (!pingContainers.fromUser.toUser.hasOwnProperty(toUserId)) {
			continue;
		}

		var pingContainer = pingContainers.fromUser.toUser[toUserId];

		// if ToUser from this user is not in a superFocus session and they also have msg pinged for you,
		// then their session will end automatically (so no need to handle it here)
		if ((!pingContainer.session || pingContainer.session && !pingContainer.session.dataValues.superFocus) && pingContainers.toUser.fromUser[toUserId]) {
			pingContainer.thisPingEndedUsersSessionsTogether = true;
			pingContainers.fromUser.toUser[toUserId] = pingContainer;
			continue;
		}

		var _session = pingContainer.session;
		var pings = pingContainer.pings;

		var ToUser = pingContainer.user;

		if (_session) {
			var _session$dataValues2 = _session.dataValues;
			var content = _session$dataValues2.content;
			var endTime = _session$dataValues2.endTime;

			var endTimeString = (0, _momentTimezone2.default)(endTime).tz(ToUser.dataValues.tz).format("h:mma");

			var sessionMessage = '<@' + ToUser.dataValues.SlackUserId + '> is working on `' + content + '` until *' + endTimeString + '*.';

			// separation when only queued 1 ping vs many pings
			if (pings.length == 1) {

				sessionMessage = sessionMessage + '  I\'ll send this ping then, unless you think it\'s urgent and want to send now:';

				var ping = pings[0];
				var attachments = (0, _messageHelpers.getPingMessageContentAsAttachment)(ping);
				var actions = (0, _messageHelpers.getHandleQueuedPingActions)(ping);

				attachments.push({
					attachment_type: 'default',
					callback_id: "HANDLE_QUEUED_PING_TO_USER",
					fallback: 'What do you want to do with this ping?',
					actions: actions
				});

				convo.say({
					text: sessionMessage,
					attachments: attachments
				});
			} else {
				// if > 1 pings queued, only 1 session message and then send content out for each ping
				sessionMessage = sessionMessage + '  I\'ll send your pings then, unless you think it\'s urgent and want to send now:';
				convo.say(sessionMessage);

				pings.forEach(function (ping, index) {

					var numberString = (0, _messageHelpers.stringifyNumber)(index + 1);

					var attachments = (0, _messageHelpers.getPingMessageContentAsAttachment)(ping);
					var actions = (0, _messageHelpers.getHandleQueuedPingActions)(ping);
					attachments.push({
						attachment_type: 'default',
						callback_id: "HANDLE_QUEUED_PING_TO_USER",
						fallback: 'What do you want to do with this ping?',
						actions: actions
					});

					convo.say({
						text: '*Here\'s your ' + numberString + ' ping:*',
						attachments: attachments
					});
				});
			}
		} else {
			convo.say('<@' + ToUser.dataValues.SlackUserId + '> does not have a current focus set, so I just started a conversation between you two :simple_smile:');
		}
	}
}
//# sourceMappingURL=endSessionFunctions.js.map