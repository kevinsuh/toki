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
				var id = user.id;

				convo.pingObject.pingUserId = id;

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
				// create slack user on spot here
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
			var count = 0;

			convo.ask({
				text: text,
				attachments: attachments
			}, [{
				pattern: _constants.utterances.containsSendAt,
				callback: function callback(response, convo) {

					// if date here, pre-fill it
					var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(response, tz);
					if (customTimeObject) {
						convo.pingObject.pingTimeObject = customTimeObject;
						convo.pingObject.deliveryType = "grenade";
					}

					askForPingTime(convo);
					convo.next();
				}
			}, {
				pattern: _constants.utterances.sendSooner,
				callback: function callback(response, convo) {
					askForPingTime(convo);
					convo.next();
				}
			}, {
				default: true,
				callback: function callback(response, convo) {

					count++;

					var pingMessageListUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot, "PING_MESSAGE_LIST");
					if (pingMessageListUpdate) {

						attachments[0].actions = [{
							name: _constants.buttonValues.sendAtEndOfSession.name,
							text: 'Send at ' + endTimeString,
							value: 'Send at ' + endTimeString,
							type: 'button'
						}, {
							name: _constants.buttonValues.sendSooner.name,
							text: ':bomb: Send sooner :bomb:',
							value: _constants.buttonValues.sendSooner.value,
							type: 'button'
						}];

						attachments[0].text = count == 1 ? response.text : attachments[0].text + '\n' + response.text;

						pingMessageListUpdate.attachments = JSON.stringify(attachments);
						bot.api.chat.update(pingMessageListUpdate);
					}
				}
			}]);
		})();
	} else {
		startPingFlow(convo);
	}
}

function askForPingTime(convo) {
	var _convo$pingObject5 = convo.pingObject;
	var SlackUserId = _convo$pingObject5.SlackUserId;
	var bot = _convo$pingObject5.bot;
	var tz = _convo$pingObject5.tz;
	var pingTimeObject = _convo$pingObject5.pingTimeObject;
	var pingSlackUserId = _convo$pingObject5.pingSlackUserId;
	var userInSession = _convo$pingObject5.userInSession;

	// if user is in a session and you have not set what time you want to ping yet

	if (!pingTimeObject && userInSession) {
		(function () {
			var user = userInSession.user;
			var endTimeObject = userInSession.endTimeObject;


			var now = (0, _momentTimezone2.default)().tz(tz);
			var minutesLeft = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(now)).asMinutes() / 2);
			var exampleEndTime = now.add(Math.round(minutesLeft / 2), 'minutes').format("h:mma");
			var endTimeString = endTimeObject.format("h:mma");

			var text = 'Would you like to send this urgent message now, or at a specific time before ' + endTimeString + '? If it’s the latter, just tell me the time, like `' + exampleEndTime + '`';
			var attachments = [{
				attachment_type: 'default',
				callback_id: "PING_GRENADE",
				fallback: "When do you want to ping?",
				actions: [{
					name: _constants.buttonValues.now.name,
					text: ':bomb: Now :bomb:',
					value: _constants.buttonValues.now.value,
					type: 'button'
				}]
			}];

			convo.ask({
				text: text,
				attachments: attachments
			}, [{
				pattern: _constants.utterances.containsNow,
				callback: function callback(response, convo) {

					// send now
					convo.pingObject.deliveryType = "bomb";
					convo.say(':point_left: Got it! I\'ll send your message to <@' + user.dataValues.SlackUserId + '> :runner: :pencil:');
					convo.next();
				}
			}, {
				pattern: _constants.utterances.sendSooner,
				callback: function callback(response, convo) {
					askForPingTime(convo);
					convo.next();
				}
			}, {
				default: true,
				callback: function callback(response, convo) {

					count++;

					var pingMessageListUpdate = (0, _messageHelpers.getMostRecentMessageToUpdate)(response.channel, bot, "PING_MESSAGE_LIST");
					if (pingMessageListUpdate) {

						attachments[0].actions = [{
							name: _constants.buttonValues.sendAtEndOfSession.name,
							text: 'Send at ' + endTimeString,
							value: 'Send at ' + endTimeString,
							type: 'button'
						}, {
							name: _constants.buttonValues.sendSooner.name,
							text: ':bomb: Send sooner :bomb:',
							value: _constants.buttonValues.sendSooner.value,
							type: 'button'
						}];

						attachments[0].text = count == 1 ? response.text : attachments[0].text + '\n' + response.text;

						pingMessageListUpdate.attachments = JSON.stringify(attachments);
						bot.api.chat.update(pingMessageListUpdate);
					}
				}
			}]);
		})();
	}

	convo.next();
}
//# sourceMappingURL=pingFunctions.js.map