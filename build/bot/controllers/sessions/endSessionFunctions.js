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


	var startTimeObject = void 0;
	var endTimeObject = void 0;
	var endTimeString = void 0;
	var sessionMinutes = void 0;
	var sessionTimeString = void 0;
	var message = ' ';
	var letsFocusMessage = 'When you’re ready, let me know when you’d like to focus again';

	// add session info if existing
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

	// if this flow is triggered by ended by ping ToUser, and the userId of this session matches with FromUser.UserId of ping
	if (endSessionType == _constants.constants.endSessionTypes.endByPingToUserId && pingInfo && pingInfo.FromUser.dataValues.id == UserId) {

		// send this only if there are LIVE pings remaining from this user => ToUser ping!

		// ended by someone else. user may or may not be in session

		var PingId = pingInfo.PingId;
		var FromUser = pingInfo.FromUser;
		var ToUser = pingInfo.ToUser;


		message = 'Hey! <@' + ToUser.dataValues.SlackName + '> just finished their session';
		if (pingInfo.endSessionType == _constants.constants.endSessionTypes.endSessionEarly) {
			message = message + ' early';
		}
		message = message + '\n:point_left: I just kicked off a conversation between you two';

		if (pingInfo.session) {
			letsFocusMessage = 'I ended your focused session on `' + session.dataValues.content + '`. ' + letsFocusMessage;
		}
	} else if (session) {
		// session must exist for all endSessionTypes other than endByPingToUserId
		message = 'Great work on `' + session.dataValues.content + '`! You were focused for *' + sessionTimeString + '*';
	}

	convo.say(message); // this message is relevant to how session got ended (ex. sessionTimerUp vs endByPingToUserId)
	handleToUserPings(convo);
	handleFromUserPings(convo);

	convo.say({
		text: letsFocusMessage,
		attachments: _constants.letsFocusAttachments
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

	var message = ' ';

	// this if previous ping FromUser caused end session together!
	if (pingInfo.thisPingEndsUsersSessionsTogether) {
		return;
	}

	var slackUserIds = [];
	for (var fromUserId in pingContainers.toUser.fromUser) {

		if (!pingContainers.toUser.fromUser.hasOwnProperty(fromUserId)) {
			continue;
		}

		var pingContainer = pingContainers.toUser.fromUser[fromUserId];
		var FromUser = pingContainer.user;

		if (!_lodash2.default.includes(slackUserIds, FromUser.dataValues.SlackUserId)) {
			slackUserIds.push(FromUser.dataValues.SlackUserId);
		}
	}

	var slackNamesString = (0, _messageHelpers.commaSeparateOutStringArray)(slackUserIds, { SlackUserIds: true });

	if (slackUserIds.length == 1) {
		message = 'While you were heads down, ' + slackNamesString + ' asked me to send you a message after your session :relieved:';
	} else if (slackUserIds.length > 1) {
		message = 'While you were heads down, you received messages from ' + slackNamesString;
	}

	convo.say(message);

	message = ' ';
	if (slackUserIds.length == 1) {
		message = ':point_left: I just kicked off a conversation between you both';
	} else if (slackUserIds.length > 1) {
		message = ':point_left: I just kicked off separate conversations between you and each of them';
	}

	convo.say(message);
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

	// UserId is fromUserId because it is this user who is ending session

	for (var toUserId in pingContainers.fromUser.toUser) {

		if (!pingContainers.fromUser.toUser.hasOwnProperty(toUserId)) {
			continue;
		}

		var pingContainer = pingContainers.fromUser.toUser[toUserId];

		// if ToUser from this user is not in a superFocus session
		// and they also have msg pinged for you,
		// then their session will end automatically
		// so no need to handle it here
		if (pingContainer.session && !pingContainer.session.dataValues.superFocus && pingContainers.toUser.fromUser[UserId]) {
			pingContainer.thisPingEndsUsersSessionsTogether = true;
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

			var sessionMessage = '<@' + ToUser.dataValues.SlackUserId + '> is focusing on `' + content + '` until *' + endTimeString + '*.';

			// separation when only queued 1 ping vs many pings
			if (pings.length == 1) {
				sessionMessage = sessionMessage + '  I\'ll send your ping then, unless this is urgent and you want to send it now';
				var actions = [{
					name: _constants.buttonValues.sendNow.name,
					text: "Send now :bomb:",
					value: '{"updatePing": true, "sendBomb": true, "PingId": "' + pings[0].dataValues.id + '"}',
					type: "button"
				}, {
					name: _constants.buttonValues.cancelPing.name,
					text: "Cancel ping :negative_squared_cross_mark:",
					value: '{"updatePing": true, "cancelPing": true, "PingId": "' + pings[0].dataValues.id + '"}',
					type: "button"
				}];
				convo.say({
					text: sessionMessage,
					actions: actions
				});
			} else {
				// if > 1 pings queued, only 1 session message and then send content out for each ping
				sessionMessage = sessionMessage + '  I\'ll send your pings then, unless you think it\'s urgent and you want to send it now';
				convo.say(sessionMessage);

				pings.forEach(function (ping, index) {

					var numberString = (0, _messageHelpers.stringifyNumber)(index + 1);

					var pingMessagesContent = '';
					ping.dataValues.PingMessages.forEach(function (pingMessage) {

						var pingMessageContent = pingMessage.dataValues.content;
						pingMessagesContent = pingMessagesContent + '\n' + pingMessageContent;
					});

					var actions = [{
						name: _constants.buttonValues.sendNow.name,
						text: "Send now :bomb:",
						value: '{"updatePing": true, "sendBomb": true, "PingId": "' + ping.dataValues.id + '"}',
						type: "button"
					}, {
						name: _constants.buttonValues.cancelPing.name,
						text: "Cancel ping :negative_squared_cross_mark:",
						value: '{"updatePing": true, "cancelPing": true, "PingId": "' + ping.dataValues.id + '"}',
						type: "button"
					}];

					var attachments = [{
						fallback: 'This message will send at the end of their session',
						color: _constants.colorsHash.toki_purple.hex,
						text: pingMessagesContent
					}, {
						fallback: 'What do you want to do with this ping?',
						actions: actions
					}];

					convo.say({
						text: '*Here\'s your ' + numberString + ' ping:*',
						attachments: attachments
					});
				});
			}
		} else {
			convo.say('<@' + ToUser.dataValues.SlackUserId + '> is not in a focused session, so I just started a conversation between you two :simple_smile:');
		}
	}
}
//# sourceMappingURL=endSessionFunctions.js.map