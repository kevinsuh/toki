'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startPingFlow = startPingFlow;

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		PING CONVERSATION FLOW FUNCTIONS
 */

function startPingFlow(convo) {
	var _convo$pingObject = convo.pingObject;
	var SlackUserId = _convo$pingObject.SlackUserId;
	var tz = _convo$pingObject.tz;
	var pingSlackUserIds = _convo$pingObject.pingSlackUserIds;


	if (pingSlackUserIds) {
		handlePingSlackUserIds(convo);
	} else {
		askWhoToPing(convo);
	}
}

function askWhoToPing(convo) {
	var _convo$pingObject2 = convo.pingObject;
	var SlackUserId = _convo$pingObject2.SlackUserId;
	var tz = _convo$pingObject2.tz;
	var pingSlackUserIds = _convo$pingObject2.pingSlackUserIds;
}

function handlePingSlackUserIds(convo) {
	var _convo$pingObject3 = convo.pingObject;
	var SlackUserId = _convo$pingObject3.SlackUserId;
	var tz = _convo$pingObject3.tz;
	var pingSlackUserIds = _convo$pingObject3.pingSlackUserIds;


	if (pingSlackUserIds) {

		var pingSlackUserId = pingSlackUserIds[0];
		convo.pingObject.pingSlackUserId = pingSlackUserId;

		_models2.default.User.find({
			where: { SlackUserId: pingSlackUserId }
		}).then(function (user) {

			if (user) {
				var SlackName = user.SlackName;

				// we will only handle 1

				if (pingSlackUserIds.length > 1) {
					convo.say('Hey! Right now I only handle one recipient DM, so I\'ll be helping you queue for <@' + user.dataValues.SlackUserId + '>. Feel free to queue another message right after this!');
				}

				// user found, handle the ping flow!
				user.getSessions({
					where: ['"open" = ?', true],
					order: '"Session"."createdAt" DESC'
				}).then(function (sessions) {

					var session = sessions[0];

					if (session) {
						// queue the message
						var _session$dataValues = session.dataValues;
						var content = _session$dataValues.content;
						var endTime = _session$dataValues.endTime;


						var now = (0, _momentTimezone2.default)().tz(tz);
						var endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
						var endTimeString = endTimeObject.format("h:mma");
						var minutesLeft = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(now)).asMinutes());

						convo.say('<@' + user.dataValues.SlackUserId + '> is focusing on `' + content + '` until *' + endTimeString + '*');
						convo.pingObject.userInSession = {
							user: user,
							endTimeObject: endTimeObject
						};
						askForQueuedPingMessages(convo);
					} else {
						// send the message
						convo.say(':point_left: <@' + user.dataValues.SlackUserId + '> is not a focused work session right now, so I started a conversation for you');
						convo.say('Thank you for being mindful of <@' + user.dataValues.SlackUserId + '>\'s attention :raised_hands:');
						convo.next();
					}
				});
			} else {
				// could not find user
				convo.say('Sorry, we couldn\'t recognize that user!');
				askWhoToPing(convo);
			}

			convo.next();
		});
	} else {
		startPingFlow(convo);
	}
}

function askForQueuedPingMessages(convo) {
	var _convo$pingObject4 = convo.pingObject;
	var SlackUserId = _convo$pingObject4.SlackUserId;
	var bot = _convo$pingObject4.bot;
	var tz = _convo$pingObject4.tz;
	var userInSession = _convo$pingObject4.userInSession;


	if (userInSession) {
		(function () {
			// we gathered appropriate info about user
			var user = userInSession.user;
			var endTimeObject = userInSession.endTimeObject;

			var endTimeString = endTimeObject.format("h:mma");

			var text = 'What would you like me to send <@' + user.dataValues.SlackUserId + '> at *' + endTimeString + '*?';
			var attachments = [{
				text: "Enter as many lines as you’d like to include in the message then choose one of the send options when your message is ready to go\n(These few lines will delete after you type your first line and hit Enter :wink:)",
				attachment_type: 'default',
				callback_id: "PING_MESSAGE_LIST",
				fallback: "What is the message you want to queue up?"
			}];

			convo.ask({
				text: text,
				attachments: attachments
			}, [{
				pattern: _constants.utterances.containsSendAt,
				callback: function callback(response, convo) {
					// 
				}
			}, {
				pattern: _constants.utterances.sendSooner,
				callback: function callback(response, convo) {}
			}, {
				default: true,
				callback: function callback(response, convo) {

					var pingMessageListUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot, "PING_MESSAGE_LIST");
					if (pingMessageListUpdate) {

						attachments[0].actions = [{
							name: _constants.buttonValues.sendAtEndOfSession.name,
							text: 'Send at ' + endTimeString,
							value: _constants.buttonValues.sendAtEndOfSession.value,
							type: 'button'
						}, {
							name: _constants.buttonValues.sendSooner.name,
							text: ':bomb: Send sooner :bomb:',
							value: _constants.buttonValues.sendSooner.value,
							type: 'button'
						}];
						attachments[0].text = 'UPDATED TEXT';

						pingMessageListUpdate.attachments = JSON.stringify(attachments);
						console.log(pingMessageListUpdate);
						bot.api.chat.update(pingMessageListUpdate);
					}
				}
			}]);
		})();
	} else {
		startPingFlow(convo);
	}
}
//# sourceMappingURL=pingFunctions.js.map