'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.hears([_constants.utterances.startsWithPing], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			convo.say('It looks like you’re trying to ping a teammate! :mailbox_with_mail:');
			convo.say("Just type `/ping @user [message]`\nLike this `/ping @colleen did Janet submit the assets to the portal yet?`");
		});
	});

	/**
  *		Enter ping flow via Wit
  *		we now encourage user to just do via slash command
  */
	controller.hears(['ping'], 'direct_message', _index.wit.hears, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];
		var SlackUserId = message.user;

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			convo.say('It looks like you’re trying to ping a teammate! :mailbox_with_mail:');
			convo.say("Just type `/ping @user [message]`\nLike this `/ping @colleen did Janet submit the assets to the portal yet?`");
		});
	});

	/**
  * 		COLLABORATE NOW FLOW
  * 		this will begin collaborate now flow with user who you clicked
  */
	controller.on('collaborate_now_flow', function (bot, message) {
		var config = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		// config is through button-click flow
		var SlackUserId = config.SlackUserId;
		var collaborateNowSlackUserIds = config.collaborateNowSlackUserIds;

		var pingMessages = [];

		// this is through slash-command flow
		if (!SlackUserId && message) {

			var _SlackUserId = message.user;
			var text = message.text;

			collaborateNowSlackUserIds = (0, _messageHelpers.getUniqueSlackUsersFromString)(text);

			if (collaborateNowSlackUserIds) {
				// this replaces up to "ping <@UIFSMIOM>"
				var pingMessage = text.replace(/^pi[ng]{1,4}([^>]*>)?/, "").trim();
				if (pingMessage) {
					pingMessages.push(pingMessage);
				}
			}
		}

		// allow customization
		if (config) {
			if (config.pingMessages) {
				pingMessages = config.pingMessages;
			}
			if (config.collaborateNowSlackUserIds) {
				collaborateNowSlackUserIds = config.collaborateNowSlackUserIds;
			}
		}

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var tz = user.tz;

			var UserId = user.id;

			var isNotAlreadyInConversation = (0, _slackHelpers.checkIsNotAlreadyInConversation)(controller, SlackUserId);

			if (!isNotAlreadyInConversation) {
				// user is already in conversation, do not continue here!
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				// have 5-minute exit time limit
				if (convo) convo.task.timeLimit = 1000 * 60 * 5;

				convo.pingObject = {
					SlackUserId: SlackUserId,
					UserId: UserId,
					bot: bot,
					tz: tz,
					collaborateNowSlackUserIds: collaborateNowSlackUserIds,
					pingMessages: pingMessages
				};

				var collaborateNowSlackUserId = collaborateNowSlackUserIds[0];
				if (collaborateNowSlackUserId) {

					if (collaborateNowSlackUserId == SlackUserId) {
						convo.pingObject.neverMind = true;
						convo.say(' '); // maybe you can say "You cant ping yourself!"
					} else {

						convo.say(' ');

						// for collaborating now
						// 1. Toki temporarily turns off DND, while knowing how many minutes left you have
						// 2. Starts the conversation between you and that person, sending you a message
						// 3. Toki turns DND back on

						_models2.default.User.find({
							where: { SlackUserId: collaborateNowSlackUserId }
						}).then(function (toUser) {

							if (toUser) {
								(function () {
									var accessToken = toUser.dataValues.accessToken;


									var toUserSlackUserId = toUser.dataValues.SlackUserId;
									var SlackUserIds = SlackUserId + ',' + toUserSlackUserId;

									toUser.getSessions({
										where: ['"open" = ?', true]
									}).then(function (sessions) {

										var session = sessions[0];

										if (session) {
											(function () {
												var _session$dataValues = session.dataValues;
												var content = _session$dataValues.content;
												var startTime = _session$dataValues.startTime;
												var endTime = _session$dataValues.endTime;

												var now = (0, _momentTimezone2.default)();
												var endTimeObject = (0, _momentTimezone2.default)(endTime);
												var remainingMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(now)).asMinutes());

												bot.api.dnd.endSnooze({
													token: accessToken
												}, function (err, res) {

													if (!err) {

														bot.api.mpim.open({
															users: SlackUserIds
														}, function (err, res) {

															if (!err) {
																var id = res.group.id;

																bot.startConversation({ channel: id }, function (err, convo) {
																	convo.say('Hey <@' + toUserSlackUserId + '>! <@' + SlackUserId + '> wants to talk about something relevant to `' + content + '`');
																	convo.on('end', function (convo) {

																		// turn back on DND
																		bot.api.dnd.setSnooze({
																			token: accessToken,
																			num_minutes: remainingMinutes
																		}, function (err, res) {

																			console.log('\n\n\n~~ setting snooze back on after collaborate now!');
																			if (!err) {
																				console.log(res);
																			} else {
																				console.log(err);
																			}
																			console.log('\n~~\n\n');
																		});
																	});
																});
															} else {

																console.log('\n\n error in trying mpim open in sendPing.js');
																console.log(err);
															}
														});
													} else {
														console.log('\n\n\n error in dnd end snooze in sendPing.js');
														console.log(err);
													}
												});
											})();
										} else {

											// not in session, still want to send msg
											bot.api.mpim.open({
												users: SlackUserIds
											}, function (err, res) {

												if (!err) {
													var id = res.group.id;

													bot.startConversation({ channel: id }, function (err, convo) {

														convo.say('Hey <@' + toUserSlackUserId + '>! You\'re not currently in a focus session and <@' + SlackUserId + '> wanted to reach out');
													});
												} else {

													console.log('\n\n error in trying mpim open in sendPing.js');
													console.log(err);
												}
											});
										}
									});
								})();
							}
						});
					}
				} else {
					// error!
					convo.pingObject.neverMind = true;
					convo.say(' ');
				}

				convo.on('end', function (convo) {

					console.log('\n\n\n ~~ end of collaborate now object ~~ \n\n\n');
				});
			});
		});
	});

	/**
  * 		ACTUAL PING FLOW
  * 		this will begin the ping flow with user
  */
	controller.on('ping_flow', function (bot, message) {
		var config = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];


		console.log('\n\n\n PING FLOW:');
		console.log(message);
		console.log('\n\n\n\n');
		console.log(config);

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		// config is through button-click flow
		var SlackUserId = config.SlackUserId;
		var pingSlackUserIds = config.pingSlackUserIds;

		var pingMessages = [];

		// this is through slash-command flow
		if (!SlackUserId && message) {

			var _SlackUserId2 = message.user;
			var text = message.text;

			pingSlackUserIds = (0, _messageHelpers.getUniqueSlackUsersFromString)(text);

			if (pingSlackUserIds) {
				// this replaces up to "ping <@UIFSMIOM>"
				var pingMessage = text.replace(/^pi[ng]{1,4}([^>]*>)?/, "").trim();
				if (pingMessage) {
					pingMessages.push(pingMessage);
				}
			}
		}

		// allow customization
		if (config) {
			if (config.pingMessages) {
				pingMessages = config.pingMessages;
			}
			if (config.pingSlackUserIds) {
				pingSlackUserIds = config.pingSlackUserIds;
			}
		}

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var tz = user.tz;

			var UserId = user.id;

			var isNotAlreadyInConversation = (0, _slackHelpers.checkIsNotAlreadyInConversation)(controller, SlackUserId);

			if (!isNotAlreadyInConversation) {
				// user is already in conversation, do not continue here!
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				// have 5-minute exit time limit
				if (convo) convo.task.timeLimit = 1000 * 60 * 5;

				convo.pingObject = {
					SlackUserId: SlackUserId,
					UserId: UserId,
					bot: bot,
					tz: tz,
					pingSlackUserIds: pingSlackUserIds,
					pingMessages: pingMessages
				};

				if (pingSlackUserIds && pingSlackUserIds[0] == SlackUserId) {
					convo.pingObject.neverMind = true;
					convo.say(' '); // maybe you can say "You cant ping yourself!"
				} else {
					(0, _pingFunctions.confirmTimeZoneExistsThenStartPingFlow)(convo);
				}

				convo.on('end', function (convo) {

					console.log('\n\n\n ~~ end of ping object ~~ \n\n\n');

					var _convo$pingObject = convo.pingObject;
					var SlackUserId = _convo$pingObject.SlackUserId;
					var tz = _convo$pingObject.tz;
					var pingUserId = _convo$pingObject.pingUserId;
					var pingSlackUserId = _convo$pingObject.pingSlackUserId;
					var pingTimeObject = _convo$pingObject.pingTimeObject;
					var userInSession = _convo$pingObject.userInSession;
					var deliveryType = _convo$pingObject.deliveryType;
					var pingMessages = _convo$pingObject.pingMessages;
					var neverMind = _convo$pingObject.neverMind;


					if (neverMind) // do not send if this is the case!
						return;

					var fromUserConfig = { UserId: UserId, SlackUserId: SlackUserId };
					var toUserConfig = { UserId: pingUserId, SlackUserId: pingSlackUserId };
					var config = { userInSession: userInSession, deliveryType: deliveryType, pingTimeObject: pingTimeObject, pingMessages: pingMessages };

					(0, _pingFunctions.queuePing)(bot, fromUserConfig, toUserConfig, config);
				});
			});
		});
	});

	/**
  * 		BOMB THE PING MESSAGE FUNCTIONALITY (via button)
  */
	controller.on('update_ping_message', function (bot, config) {
		var PingId = config.PingId;
		var sendBomb = config.sendBomb;
		var cancelPing = config.cancelPing;


		_models2.default.Ping.find({
			where: { id: PingId },
			include: [{ model: _models2.default.User, as: 'FromUser' }, { model: _models2.default.User, as: 'ToUser' }, _models2.default.PingMessage]
		}).then(function (ping) {

			// this is a `bomb` to ToUser
			var _ping$dataValues = ping.dataValues;
			var FromUser = _ping$dataValues.FromUser;
			var ToUser = _ping$dataValues.ToUser;
			var tz = FromUser.dataValues.tz;


			bot.startPrivateConversation({ user: FromUser.dataValues.SlackUserId }, function (err, convo) {

				if (sendBomb) {
					convo.say(':point_left: Got it! I just kicked off a conversation between you and <@' + ToUser.dataValues.SlackUserId + '> for that ping');
				} else if (cancelPing) {
					convo.say('That ping to <@' + ToUser.dataValues.SlackUserId + '> has been canceled!');
				}

				convo.on('end', function (convo) {

					if (sendBomb) {
						_models2.default.Ping.update({
							live: true,
							deliveryType: _constants.constants.pingDeliveryTypes.bomb
						}, {
							where: { id: PingId }
						});
					} else if (cancelPing) {
						_models2.default.Ping.update({
							live: false
						}, {
							where: { id: PingId }
						});
					}
				});
			});
		});
	});

	/**
  * 		CANCEL PINGS FUNCTIONALITY (i.e. while you are in middle of session)
  */
	controller.on('cancel_ping_flow', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;

		// get all of user's pings to others and then go through wizard to cancel
		// if only one ping, automatically cancel

		bot.send({
			type: "typing",
			channel: message.channel
		});

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.tz;

			var UserId = user.id;

			// check for an open session before starting flow
			user.getSessions({
				where: ['"open" = ?', true]
			}).then(function (sessions) {

				var session = sessions[0];

				if (session) {
					(function () {
						var _session$dataValues2 = session.dataValues;
						var endTime = _session$dataValues2.endTime;
						var content = _session$dataValues2.content;

						var endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
						var endTimeString = endTimeObject.format("h:mma");

						_models2.default.Ping.findAll({
							where: ['"Ping"."FromUserId" = ? AND "Ping"."live" = ?', UserId, true],
							include: [{ model: _models2.default.User, as: 'FromUser' }, { model: _models2.default.User, as: 'ToUser' }, _models2.default.PingMessage],
							order: '"Ping"."createdAt" ASC'
						}).then(function (pings) {

							// get all the sessions associated with pings that come FromUser
							var pingerSessionPromises = [];
							pings.forEach(function (ping) {
								var ToUserId = ping.dataValues.ToUserId;

								pingerSessionPromises.push(_models2.default.Session.findAll({
									where: {
										UserId: ToUserId,
										live: true,
										open: true
									},
									include: [_models2.default.User]
								}));
							});

							var pingerSessions = [];
							Promise.all(pingerSessionPromises).then(function (pingerSessionsArrays) {

								// returns double array of pingerSessions -- only get the unique ones!
								pingerSessionsArrays.forEach(function (pingerSessionsArray) {
									var pingerSessionIds = pingerSessions.map(function (pingerSession) {
										return pingerSession.dataValues.id;
									});
									pingerSessionsArray.forEach(function (pingerSession) {
										if (!_lodash2.default.includes(pingerSessionIds, pingerSession.dataValues.id)) {
											pingerSessions.push(pingerSession);
										}
									});
								});

								pings.forEach(function (ping) {

									var pingToUserId = ping.dataValues.ToUserId;
									pingerSessions.forEach(function (pingerSession) {
										if (pingerSession && pingToUserId == pingerSession.dataValues.UserId) {
											// the session for ToUser of this ping
											ping.dataValues.session = pingerSession;
											return;
										}
									});
								});

								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

									convo.cancelPingsObject = {
										pingIdsToCancel: []
									};

									if (pings.length == 0) {

										convo.say('You have no pings to cancel!');
										var _text = 'Good luck with `' + content + '` and I’ll see you at *' + endTimeString + '* :wave:';
										var config = { customOrder: true, order: ['endSession'] };
										var attachments = (0, _messageHelpers.getStartSessionOptionsAttachment)(pings, config);

										convo.say({
											text: _text,
											attachments: attachments
										});

										convo.next();
									} else if (pings.length == 1) {

										// automatically cancel the single ping
										var ping = pings[0];
										var _ping$dataValues2 = ping.dataValues;
										var ToUser = _ping$dataValues2.ToUser;
										var id = _ping$dataValues2.id;


										convo.cancelPingsObject.pingIdsToCancel.push(id);

										convo.say('The ping to <@' + ToUser.dataValues.SlackUserId + '> has been canceled!');

										var _text2 = 'Good luck with `' + content + '` and I’ll see you at *' + endTimeString + '* :wave:';
										var _config = { customOrder: true, order: ['endSession'] };
										var _attachments = (0, _messageHelpers.getStartSessionOptionsAttachment)(pings, _config);

										convo.say({
											text: _text2,
											attachments: _attachments
										});

										convo.next();
									} else {

										// more than 1 ping to cancel, means ask which one to cancel!
										var _text3 = "Which ping(s) would you like to cancel? i.e. `1, 2` or `3`";
										var _attachments2 = (0, _messageHelpers.whichGroupedPingsToCancelAsAttachment)(pings);

										convo.ask({
											text: _text3,
											attachments: _attachments2
										}, [{
											pattern: _constants.utterances.noAndNeverMind,
											callback: function callback(response, convo) {
												convo.say("Okay! I didn't cancel any pings");
												convo.next();
											}
										}, {
											default: true,
											callback: function callback(response, convo) {
												var text = response.text;

												var numberArray = (0, _messageHelpers.convertNumberStringToArray)(text, pings.length);

												if (numberArray) {

													numberArray.forEach(function (number) {
														var index = number - 1;
														if (pings[index]) {
															convo.cancelPingsObject.pingIdsToCancel.push(pings[index].dataValues.id);
														}
													});

													var pingNumberCancelString = (0, _messageHelpers.commaSeparateOutStringArray)(numberArray);

													if (convo.cancelPingsObject.pingIdsToCancel.length == 1) {
														convo.say('Great, I\'ve canceled ping ' + pingNumberCancelString + '!');
													} else {
														convo.say('Great, I\'ve canceled pings ' + pingNumberCancelString + '!');
													}

													var _text4 = 'Good luck with `' + content + '` and I’ll see you at *' + endTimeString + '* :wave:';
													var _config2 = { customOrder: true, order: ['endSession'] };
													var _attachments3 = (0, _messageHelpers.getStartSessionOptionsAttachment)(pings, _config2);

													convo.say({
														text: _text4,
														attachments: _attachments3
													});
													convo.next();
												} else {
													convo.say('I didn\'t get that! Please put a combination of the numbers below');
													convo.repeat();
												}
												convo.next();
											}
										}]);
									}

									convo.on('end', function (convo) {
										var pingIdsToCancel = convo.cancelPingsObject.pingIdsToCancel;


										pingIdsToCancel.forEach(function (pingIdToCancel) {

											_models2.default.Ping.update({
												live: false
											}, {
												where: { id: pingIdToCancel }
											});
										});
									});
								});
							});
						});
					})();
				} else {
					// ask to start a session
					(0, _sessions.notInSessionWouldYouLikeToStartOne)({ bot: bot, SlackUserId: SlackUserId, controller: controller });
				}
			});
		});
	});
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _pingFunctions = require('./pingFunctions');

var _sessions = require('../sessions');

var _slackHelpers = require('../../lib/slackHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=sendPing.js.map