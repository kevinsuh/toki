'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.startPingFlow = startPingFlow;
exports.sendPing = sendPing;

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
	var text = arguments.length <= 1 || arguments[1] === undefined ? 'Who would you like to ping? You can type their username, like `@emily`' : arguments[1];
	var _convo$pingObject2 = convo.pingObject;
	var SlackUserId = _convo$pingObject2.SlackUserId;
	var tz = _convo$pingObject2.tz;
	var pingSlackUserIds = _convo$pingObject2.pingSlackUserIds;


	var attachments = [{
		attachment_type: 'default',
		callback_id: "WHO_TO_PING",
		fallback: "Who would you like to ping?",
		actions: [{
			name: _constants.buttonValues.neverMind.name,
			text: 'Never Mind!',
			value: _constants.buttonValues.neverMind.value,
			type: 'button'
		}]
	}];

	convo.ask({
		text: text,
		attachments: attachments
	}, [{
		pattern: _constants.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.say('Ok! Just let me know if you want to ping someone on your team'); // in future check if in session
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			var text = response.text;

			var pingSlackUserIds = (0, _messageHelpers.getUniqueSlackUsersFromString)(text);

			if (pingSlackUserIds.length > 0) {

				convo.pingObject.pingSlackUserIds = pingSlackUserIds;
				handlePingSlackUserIds(convo);
			} else {
				askWhoToPing(convo, 'Whoops! Try *typing @ + the first few letters of the intended recipient’s first name*, like `@matt` , then clicking on the correct recipient');
			}

			convo.next();
		}
	}]);
}

function handlePingSlackUserIds(convo) {
	var _convo$pingObject3 = convo.pingObject;
	var SlackUserId = _convo$pingObject3.SlackUserId;
	var tz = _convo$pingObject3.tz;
	var bot = _convo$pingObject3.bot;
	var pingSlackUserIds = _convo$pingObject3.pingSlackUserIds;


	if (pingSlackUserIds) {
		(function () {

			var pingSlackUserId = pingSlackUserIds[0];
			convo.pingObject.pingSlackUserId = pingSlackUserId;

			_models2.default.User.find({
				where: { SlackUserId: pingSlackUserId }
			}).then(function (user) {

				if (user) {
					var SlackName = user.SlackName;
					var _id = user.id;

					convo.pingObject.pingUserId = _id;

					// we will only handle 1
					if (pingSlackUserIds.length > 1) {
						convo.say('Hey! Right now I only handle one recipient DM, so I\'ll be helping you with <@' + user.dataValues.SlackUserId + '>. Feel free to queue another message right after this!');
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
							convo.say(':point_left: <@' + user.dataValues.SlackUserId + '> is not in a focused work session right now, so I started a conversation for you');
							convo.say('Thank you for being mindful of <@' + user.dataValues.SlackUserId + '>\'s attention :raised_hands:');
							convo.next();
						}
					});
				} else {
					// could not find user

					bot.api.users.info({ user: pingSlackUserId }, function (err, response) {
						if (!err) {
							var _response$user = response.user;
							var _id2 = _response$user.id;
							var team_id = _response$user.team_id;
							var name = _response$user.name;
							var _tz = _response$user.tz;

							var email = user.profile && user.profile.email ? user.profile.email : '';
							_models2.default.User.create({
								TeamId: team_id,
								email: email,
								tz: _tz,
								SlackUserId: _id2,
								SlackName: name
							}).then(function () {
								handlePingSlackUserIds(convo);
							});
						} else {
							convo.say('Sorry, I can\'t recognize that user!');
							askWhoToPing(convo);
						}
					});
				}

				convo.next();
			});
		})();
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
			var now = (0, _momentTimezone2.default)().tz(tz);
			var minutesLeft = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(now)).asMinutes());

			var text = 'What would you like me to send <@' + user.dataValues.SlackUserId + '> at *' + endTimeString + '*?';
			var attachments = [{
				text: "Enter as many lines as you’d like to include in the message then choose one of the send options when your message is ready to go\n(These few lines will delete after you type your first line and hit Enter :wink:)",
				attachment_type: 'default',
				callback_id: "PING_MESSAGE_LIST",
				mrkdwn_in: ["text"],
				fallback: "What is the message you want to queue up?"
			}];

			var pingMessages = [];

			convo.ask({
				text: text,
				attachments: attachments
			}, [{
				pattern: _constants.utterances.containsSendAt,
				callback: function callback(response, convo) {

					convo.pingObject.pingMessages = pingMessages;

					var text = '';

					// if date here, pre-fill it
					var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(response, tz);
					if (customTimeObject) {

						// equal times
						var customTimeString = customTimeObject.format("h:mma");

						if (customTimeString == endTimeString) {
							// sessionEnd ping
							convo.pingObject.deliveryType = "sessionEnd";
							convo.say('Thank you for being mindful of <@' + user.dataValues.SlackUserId + '>’s attention :raised_hands:');
							convo.say('I’ll send your message at *' + customTimeString + '*! :mailbox_with_mail:');
							convo.next();
						} else {

							if (now < customTimeObject && customTimeObject < endTimeObject) {
								// grenade ping
								convo.pingObject.pingTimeObject = customTimeObject;
								convo.pingObject.deliveryType = "grenade";
								convo.say('Excellent! I’ll be sending your message to <@' + user.dataValues.SlackUserId + '> at *' + customTimeObject.format("h:mma") + '* :mailbox_with_mail:');
							} else {
								// invalid time for grenade ping
								var minutesBuffer = Math.round(minutesLeft / 4);
								now = (0, _momentTimezone2.default)().tz(tz);
								var exampleEndTimeObjectOne = now.add(minutesBuffer, 'minutes');
								now = (0, _momentTimezone2.default)().tz(tz);
								var exampleEndTimeObjectTwo = now.add(minutesLeft - minutesBuffer, 'minutes');
								convo.say('The time has to be between now and ' + endTimeString + '. You can input times like `' + exampleEndTimeObjectOne.format("h:mma") + '` or `' + exampleEndTimeObjectTwo.format("h:mma") + '`');
								text = "When would you like to send your urgent message?";
							}

							askForPingTime(convo, text);
							convo.next();
						}
					}
				}
			}, {
				pattern: _constants.utterances.sendSooner,
				callback: function callback(response, convo) {

					convo.pingObject.pingMessages = pingMessages;

					askForPingTime(convo);
					convo.next();
				}
			}, {
				default: true,
				callback: function callback(response, convo) {

					pingMessages.push(response.text);

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

						attachments[0].text = pingMessages.length == 1 ? response.text : attachments[0].text + '\n' + response.text;
						attachments[0].color = _constants.colorsHash.toki_purple.hex;

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
	var text = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
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
			var minutesLeft = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(now)).asMinutes());
			var exampleEndTimeObject = void 0;
			if (minutesLeft > 10) {
				exampleEndTimeObject = now.add(minutesLeft - 10, 'minutes');
			} else {
				exampleEndTimeObject = now.add(Math.round(minutesLeft / 2), 'minutes');
			}

			var exampleEndTimeString = exampleEndTimeObject.format("h:mma");
			var endTimeString = endTimeObject.format("h:mma");

			if (text == '') {
				text = 'Would you like to send this urgent message now, or at a specific time before ' + endTimeString + '? If it’s the latter, just tell me the time, like `' + exampleEndTimeString + '`';
			}

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
				default: true,
				callback: function callback(response, convo) {

					var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(response, tz);
					if (customTimeObject) {
						now = (0, _momentTimezone2.default)().tz(tz);
						if (now < customTimeObject && customTimeObject < endTimeObject) {
							// success!
							convo.pingObject.pingTimeObject = customTimeObject;
							convo.pingObject.deliveryType = "grenade";
							convo.say('Excellent! I’ll be sending your message to <@' + user.dataValues.SlackUserId + '> at *' + customTimeObject.format("h:mma") + '* :mailbox_with_mail:');
						} else {
							// has to be less than or equal to end time
							var minutesBuffer = Math.round(minutesLeft / 4);
							now = (0, _momentTimezone2.default)().tz(tz);
							var exampleEndTimeObjectOne = now.add(minutesBuffer, 'minutes');
							now = (0, _momentTimezone2.default)().tz(tz);
							var exampleEndTimeObjectTwo = now.add(minutesLeft - minutesBuffer, 'minutes');
							convo.say('The time has to be between now and ' + endTimeString + '. You can input times like `' + exampleEndTimeObjectOne.format("h:mma") + '` or `' + exampleEndTimeObjectTwo.format("h:mma") + '`');
							askForPingTime(convo, "When would you like to send your urgent message?");
						}
					} else {

						convo.say('I didn\'t quite get that :thinking_face:');
						convo.repeat();
					}

					convo.next();
				}
			}]);
		})();
	}

	convo.next();
}

/**
 * 
 * This handles logic of sending ping depending on session info
 * 
 * @param  {bot} bot      requires bot of TeamId
 * @param  {UserId, SlackUserId} fromUser
 * @param  {UserId, SlackUserId} toUser   
 * @param  {deliveryType, pingTimeObject, pingMessages } config   [description]
 */
function sendPing(bot, fromUser, toUser, config) {
	var pingTimeObject = config.pingTimeObject;
	var pingMessages = config.pingMessages;
	var deliveryType = config.deliveryType;


	if (!deliveryType) deliveryType = "endSession"; // default to endSession ping

	var SlackUserIds = fromUser.SlackUserId + ',' + toUser.SlackUserId;

	_models2.default.User.find({
		where: { SlackUserId: toUser.SlackUserId }
	}).then(function (toUser) {

		if (toUser) {

			// user found, handle the ping flow!
			toUser.getSessions({
				where: ['"open" = ?', true],
				order: '"Session"."createdAt" DESC'
			}).then(function (sessions) {

				var session = sessions[0];

				if (session) {

					_models2.default.Ping.create({
						FromUserId: fromUser.UserId,
						ToUserId: toUser.UserId,
						deliveryType: deliveryType,
						pingTime: pingTimeObject
					}).then(function (ping) {
						if (pingMessages) {
							pingMessages.forEach(function (pingMessage) {
								_models2.default.PingMessage.create({
									PingId: ping.id,
									content: pingMessage
								});
							});
						}
					});
				} else {

					bot.api.mpim.open({
						users: SlackUserIds
					}, function (err, response) {
						if (!err) {
							(function () {
								var id = response.group.id;

								var text = 'Hey <@' + toUser.SlackUserId + '>! You\'re not in a session and <@' + fromUser.SlackUserId + '> wanted to reach out :raised_hands:';
								var attachments = [];

								bot.startConversation({ channel: id }, function (err, convo) {

									if (pingMessages) {
										pingMessages.forEach(function (pingMessage) {
											attachments.push({
												text: pingMessage,
												mrkdwn_in: ["text"],
												attachment_type: 'default',
												callback_id: "PING_MESSAGE",
												fallback: pingMessage,
												color: _constants.colorsHash.toki_purple.hex
											});
										});
									}
									convo.say({
										text: text,
										attachments: attachments
									});
									convo.next();
								});
							})();
						}
					});
				}
			});
		} else {

			bot.startPrivateConversation({ user: fromUser.SlackUserId }, function (err, convo) {

				// could not find user, let's create
				bot.api.users.info({ user: toUser.SlackUserId }, function (err, response) {

					if (!err) {
						(function () {
							var _response$user2 = response.user;
							var id = _response$user2.id;
							var team_id = _response$user2.team_id;
							var name = _response$user2.name;
							var tz = _response$user2.tz;

							var email = user.profile && user.profile.email ? user.profile.email : '';
							_models2.default.User.create({
								TeamId: team_id,
								email: email,
								tz: tz,
								SlackUserId: id,
								SlackName: name
							}).then(function () {
								convo.say('For some reason, i didn\'t have <@' + id + '> in my database, but now I do! Thank you. Try sending this ping again :pray:');
							});
						})();
					} else {
						convo.say('Sorry, I can\'t recognize <@' + id + '>!');
					}
				});

				convo.next();
			});
		}
	});
}
//# sourceMappingURL=pingFunctions.js.map