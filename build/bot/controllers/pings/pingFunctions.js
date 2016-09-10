'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.confirmTimeZoneExistsThenStartPingFlow = confirmTimeZoneExistsThenStartPingFlow;
exports.askForPingTime = askForPingTime;
exports.queuePing = queuePing;
exports.sendGroupPings = sendGroupPings;

var _index = require('../index');

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
 * 		PING CONVERSATION FLOW FUNCTIONS
 */

function confirmTimeZoneExistsThenStartPingFlow(convo) {
	var text = arguments.length <= 1 || arguments[1] === undefined ? 'One more thing! Since I help you make time for your priorities, I need to know your *timezone* before we set our first focus session' : arguments[1];
	var _convo$pingObject = convo.pingObject;
	var SlackUserId = _convo$pingObject.SlackUserId;
	var UserId = _convo$pingObject.UserId;
	var tz = _convo$pingObject.tz;


	if (tz) {
		// user has tz config'd
		startPingFlow(convo); // entry point
		convo.next();
	} else {
		// user needs tz config'd!
		convo.ask({
			text: text,
			attachments: _constants.timeZoneAttachments
		}, function (response, convo) {
			var text = response.text;

			var timeZoneObject = false;
			switch (text) {
				case (text.match(_constants.utterances.eastern) || {}).input:
					timeZoneObject = _constants.timeZones.eastern;
					break;
				case (text.match(_constants.utterances.central) || {}).input:
					timeZoneObject = _constants.timeZones.central;
					break;
				case (text.match(_constants.utterances.mountain) || {}).input:
					timeZoneObject = _constants.timeZones.mountain;
					break;
				case (text.match(_constants.utterances.pacific) || {}).input:
					timeZoneObject = _constants.timeZones.pacific;
					break;
				case (text.match(_constants.utterances.other) || {}).input:
					timeZoneObject = _constants.timeZones.other;
					break;
				default:
					break;
			}

			if (!timeZoneObject) {
				convo.say("I didn't get that :thinking_face:");
				confirmTimeZoneExistsThenStartPingFlow(convo, 'Which timezone are you in?');
				convo.next();
			} else if (timeZoneObject == _constants.timeZones.other) {
				convo.say('Sorry!');
				convo.say("Right now I’m only able to work in these timezones. If you want to demo Toki, just pick one of these timezones for now. I’ll try to get your timezone included as soon as possible!");
				confirmTimeZoneExistsThenStartPingFlow(convo, 'Which timezone do you want to go with for now?');
				convo.next();
			} else {
				(function () {
					// success!!

					var _timeZoneObject = timeZoneObject;
					var tz = _timeZoneObject.tz;

					console.log(timeZoneObject);
					_models2.default.User.update({
						tz: tz
					}, {
						where: { id: UserId }
					}).then(function (user) {
						convo.say('Great! If this ever changes, you can always `update settings`');
						convo.pingObject.tz = tz;
						startPingFlow(convo); // entry point
						convo.next();
					});
				})();
			}
		});
	}
}

function startPingFlow(convo) {
	var _convo$pingObject2 = convo.pingObject;
	var SlackUserId = _convo$pingObject2.SlackUserId;
	var tz = _convo$pingObject2.tz;
	var pingSlackUserIds = _convo$pingObject2.pingSlackUserIds;


	if (pingSlackUserIds) {
		handlePingSlackUserIds(convo);
	} else {
		askWhoToPing(convo);
	}
}

function askWhoToPing(convo) {
	var text = arguments.length <= 1 || arguments[1] === undefined ? 'Who would you like to ping? You can type their username, like `@emily`' : arguments[1];
	var _convo$pingObject3 = convo.pingObject;
	var SlackUserId = _convo$pingObject3.SlackUserId;
	var tz = _convo$pingObject3.tz;
	var pingSlackUserIds = _convo$pingObject3.pingSlackUserIds;


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
			convo.pingObject.neverMind = true;
			convo.next();
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
	var _convo$pingObject4 = convo.pingObject;
	var SlackUserId = _convo$pingObject4.SlackUserId;
	var tz = _convo$pingObject4.tz;
	var bot = _convo$pingObject4.bot;
	var pingSlackUserIds = _convo$pingObject4.pingSlackUserIds;


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

							convo.say('<@' + user.dataValues.SlackUserId + '> is working on `' + content + '` until *' + endTimeString + '*');
							convo.pingObject.userInSession = {
								user: user,
								endTimeObject: endTimeObject
							};
							askForQueuedPingMessages(convo);
						} else {
							// send the message
							convo.pingObject.deliveryType = _constants.constants.pingDeliveryTypes.sessionNotIn;
							// let's just not ping here
							convo.say(' ');
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
	var _convo$pingObject5 = convo.pingObject;
	var SlackUserId = _convo$pingObject5.SlackUserId;
	var bot = _convo$pingObject5.bot;
	var tz = _convo$pingObject5.tz;
	var userInSession = _convo$pingObject5.userInSession;
	var pingMessages = _convo$pingObject5.pingMessages;


	if (userInSession) {
		(function () {
			// we gathered appropriate info about user
			var user = userInSession.user;
			var endTimeObject = userInSession.endTimeObject;

			var endTimeString = endTimeObject.format("h:mma");
			var now = (0, _momentTimezone2.default)().tz(tz);
			var minutesLeft = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(now)).asMinutes());

			var askMessage = 'What would you like me to send <@' + user.dataValues.SlackUserId + '> at ' + endTimeString + '?';

			var attachments = [{
				text: "Enter as many lines as you’d like to include in the message then choose one of the send options when your message is ready to go\n(These few lines will delete after you type your first line and hit Enter :wink:)",
				attachment_type: 'default',
				callback_id: "PING_MESSAGE_LIST",
				mrkdwn_in: ["text"],
				fallback: "What is the message you want to queue up?"
			}];
			var fullAttachmentActions = [{
				name: _constants.buttonValues.sendAtEndOfSession.name,
				text: 'Send at ' + endTimeString,
				value: 'Send at ' + endTimeString,
				type: 'button'
			}, {
				name: _constants.buttonValues.sendSooner.name,
				text: 'Send sooner :bomb:',
				value: _constants.buttonValues.sendSooner.value,
				type: 'button'
			}, {
				name: _constants.buttonValues.neverMind.name,
				text: 'Never mind!',
				value: _constants.buttonValues.neverMind.value,
				type: 'button'
			}];

			var actions = void 0;
			if (pingMessages && pingMessages.length > 0) {
				attachments[0].text = pingMessages[0];
				attachments[0].color = _constants.colorsHash.toki_purple.hex;
				askMessage = 'What else would you like to send to <@' + user.dataValues.SlackUserId + '> at *' + endTimeString + '*? When done, press one of the buttons!';
				actions = fullAttachmentActions;
			} else {
				actions = [{
					name: _constants.buttonValues.neverMind.name,
					text: 'Never mind!',
					value: _constants.buttonValues.neverMind.value,
					type: 'button'
				}];
			}

			var actionsAttachment = {
				attachment_type: 'default',
				callback_id: "SEND_PING_TO_USER",
				fallback: 'When do you want to send this ping?',
				actions: actions
			};
			attachments.push(actionsAttachment);

			convo.ask({
				text: askMessage,
				attachments: attachments
			}, [{
				pattern: _constants.utterances.noAndNeverMind,
				callback: function callback(response, convo) {
					convo.pingObject.neverMind = true;
					convo.say('Okay! I didn\'t deliver that message');
					convo.next();
				}
			}, {
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
							convo.pingObject.deliveryType = _constants.constants.pingDeliveryTypes.sessionEnd;
							convo.say('Thank you for being mindful of <@' + user.dataValues.SlackUserId + '>’s attention :raised_hands:');
							convo.say('I’ll send your message at *' + customTimeString + '*! :mailbox_with_mail:');
							convo.next();
						} else {

							if (now < customTimeObject && customTimeObject < endTimeObject) {
								// grenade ping
								convo.pingObject.pingTimeObject = customTimeObject;
								convo.pingObject.deliveryType = _constants.constants.pingDeliveryTypes.grenade;
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

						attachments[0].pretext = askMessage;
						attachments[0].text = pingMessages.length == 1 ? '' + response.text : attachments[0].text + '\n' + response.text;
						attachments[0].color = _constants.colorsHash.toki_purple.hex;
						attachments[attachments.length - 1].actions = fullAttachmentActions;

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
	var _convo$pingObject6 = convo.pingObject;
	var SlackUserId = _convo$pingObject6.SlackUserId;
	var bot = _convo$pingObject6.bot;
	var tz = _convo$pingObject6.tz;
	var pingTimeObject = _convo$pingObject6.pingTimeObject;
	var pingSlackUserId = _convo$pingObject6.pingSlackUserId;
	var userInSession = _convo$pingObject6.userInSession;

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
					text: 'Now :bomb:',
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
					convo.pingObject.deliveryType = _constants.constants.pingDeliveryTypes.bomb;
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
							convo.pingObject.deliveryType = _constants.constants.pingDeliveryTypes.grenade;
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
 * This handles logic of queueing ping depending on session info
 * if no session, then this will not store ping in DB and will just immediately send over
 * 
 * @param  {bot} bot      requires bot of TeamId
 * @param  {UserId, SlackUserId} fromUserConfig
 * @param  {UserId, SlackUserId} toUserConfig
 * @param  {deliveryType, pingTimeObject, pingMessages } config   [description]
 */
function queuePing(bot, fromUserConfig, toUserConfig, config) {
	var pingTimeObject = config.pingTimeObject;
	var pingMessages = config.pingMessages;
	var deliveryType = config.deliveryType;


	if (!deliveryType) deliveryType = _constants.constants.pingDeliveryTypes.sessionEnd; // default to sessionEnd ping

	var SlackUserIds = fromUserConfig.SlackUserId + ',' + toUserConfig.SlackUserId;

	_models2.default.User.find({
		where: { SlackUserId: toUserConfig.SlackUserId }
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
						FromUserId: fromUserConfig.UserId,
						ToUserId: toUserConfig.UserId,
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

					// user is not in a session!
					deliveryType = _constants.constants.pingDeliveryTypes.sessionNotIn;
					_models2.default.Ping.create({
						FromUserId: fromUserConfig.UserId,
						ToUserId: toUserConfig.UserId,
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
				}
			});
		} else {

			bot.startPrivateConversation({ user: fromUserConfig.SlackUserId }, function (err, convo) {

				// could not find user, let's create
				bot.api.users.info({ user: toUserConfig.SlackUserId }, function (err, response) {

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

// handle batch of pings with specific FromUser ToUser combination
function sendGroupPings(pings, deliveryType) {

	// first fill up both configs and make sure it is valid
	var config = fillPingUserConfig(pings);
	var handleNow = false;
	var now = (0, _momentTimezone2.default)();

	pings.some(function (ping) {
		var _ping$dataValues = ping.dataValues;
		var FromUserId = _ping$dataValues.FromUserId;
		var ToUserId = _ping$dataValues.ToUserId;
		var deliveryType = _ping$dataValues.deliveryType;
		var pingTime = _ping$dataValues.pingTime;

		if (pingTime) {
			var pingTimeObject = (0, _momentTimezone2.default)(pingTime);
			if (pingTimeObject < now) {
				handleNow = true;
				return handleNow;
			}
		} else {
			handleNow = true;
		}
	});

	// this means pings are valid
	if (handleNow && config) {
		var _ret6 = function () {

			var fromUserConfig = config.fromUser;
			var toUserConfig = config.toUser;

			var SlackUserIds = fromUserConfig.SlackUserId + ',' + toUserConfig.SlackUserId;

			_models2.default.Team.find({
				where: { TeamId: fromUserConfig.TeamId }
			}).then(function (team) {
				var token = team.token;

				var bot = _index.bots[token];

				if (bot) {
					bot.api.mpim.open({
						users: SlackUserIds
					}, function (err, response) {

						if (!err) {
							var _id3 = response.group.id;


							bot.startConversation({ channel: _id3 }, function (err, convo) {

								var initialMessage = 'Hey <@' + toUserConfig.SlackUserId + '>! <@' + fromUserConfig.SlackUserId + '> wanted to reach out';
								switch (deliveryType) {
									case _constants.constants.pingDeliveryTypes.bomb:
										initialMessage = 'Hey <@' + toUserConfig.SlackUserId + '>! <@' + fromUserConfig.SlackUserId + '> has an urgent message for you:';
										break;
									case _constants.constants.pingDeliveryTypes.grenade:
										initialMessage = 'Hey <@' + toUserConfig.SlackUserId + '>! <@' + fromUserConfig.SlackUserId + '> has an urgent message for you:';
										break;
									case _constants.constants.pingDeliveryTypes.sessionNotIn:
										initialMessage = 'Hey <@' + toUserConfig.SlackUserId + '>! You\'re not in a session and <@' + fromUserConfig.SlackUserId + '> wanted to reach out :raised_hands:';
									default:
										break;
								}

								// IM channel successfully opened with these 2 users
								if (pings.length == 1) {

									var ping = pings[0];

									initialMessage = '*' + initialMessage + '*';
									var pingMessagesContentAttachment = (0, _messageHelpers.getPingMessageContentAsAttachment)(ping);

									convo.say({
										text: initialMessage,
										attachments: pingMessagesContentAttachment
									});
								} else {

									// these need to happen one at a time

									var groupedPingMessagesAttachment = (0, _messageHelpers.getGroupedPingMessagesAsAttachment)(pings);

									convo.say({
										text: initialMessage,
										attachments: groupedPingMessagesAttachment
									});
								}
							});
						}
					});
				}
			});
			return {
				v: true
			};
		}();

		if ((typeof _ret6 === 'undefined' ? 'undefined' : _typeof(_ret6)) === "object") return _ret6.v;
	} else {
		return false;
	}
}

// this fills up fromUserConfig and toUserConfig based on batched pings
// if it is invalid, returns false
// invalid if: FromUserId is inconsistent, ToUserId is inconsistent, TeamId does not match
function fillPingUserConfig(pings) {

	var config = { fromUser: {}, toUser: {} };

	var valid = true;
	pings.forEach(function (ping) {
		var _ping$dataValues2 = ping.dataValues;
		var FromUser = _ping$dataValues2.FromUser;
		var ToUser = _ping$dataValues2.ToUser;


		var FromUserId = FromUser.dataValues.id;
		var FromUserSlackUserId = FromUser.dataValues.SlackUserId;
		var FromUserTeamId = FromUser.dataValues.TeamId;

		var ToUserId = ToUser.dataValues.id;
		var ToUserSlackUserId = ToUser.dataValues.SlackUserId;
		var ToUserTeamId = ToUser.dataValues.TeamId;

		/*
   *  Fill UserIds
   */
		if (!config.fromUser.UserId) {
			config.fromUser.UserId = FromUserId;
		} else if (config.fromUser.UserId != FromUserId) {
			valid = false;
		}

		if (!config.toUser.UserId) {
			config.toUser.UserId = ToUserId;
		} else if (config.toUser.UserId != ToUserId) {
			valid = false;
		}

		/*
   *  Fill SlackUserIds
   */
		if (!config.fromUser.SlackUserId) {
			config.fromUser.SlackUserId = FromUserSlackUserId;
		} else if (config.fromUser.SlackUserId != FromUserSlackUserId) {
			valid = false;
		}

		if (!config.toUser.SlackUserId) {
			config.toUser.SlackUserId = ToUserSlackUserId;
		} else if (config.toUser.SlackUserId != ToUserSlackUserId) {
			valid = false;
		}

		/*
   *  Fill TeamIds
   */
		if (!config.fromUser.TeamId) {
			config.fromUser.TeamId = FromUserTeamId;
		} else if (config.fromUser.TeamId != FromUserTeamId) {
			valid = false;
		}

		if (!config.toUser.TeamId) {
			config.toUser.TeamId = ToUserTeamId;
		} else if (config.toUser.TeamId != ToUserTeamId) {
			valid = false;
		}

		if (config.fromUser.TeamId != config.toUser.TeamId) {
			valid = false;
		}
	});

	if (pings.length == 0) {
		valid = false;
	}

	if (valid) {
		return config;
	} else {
		return false;
	}
}
//# sourceMappingURL=pingFunctions.js.map