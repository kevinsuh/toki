'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *
  * 		User directly asks to start a session
  * 							~* via Wit *~
  */
	controller.hears(['start_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];
		var SlackUserId = message.user;

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			convo.say('It looks like you’re trying to focus! :palm_tree:');
			convo.say("Just type `/focus [put task here] for [put duration here]`\nLike this `/focus squash front-end bug for 45 min` or `/focus marketing report until 4pm`");
		});
	});

	// this needs to be after Wit.hears `start_ession` because this is
	// a fallback. we want Wit to be trained to handle this!
	controller.hears([_constants.utterances.startsWithFocus], 'direct_message', function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];
		var SlackUserId = message.user;

		bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

			convo.say('It looks like you’re trying to focus! :palm_tree:');
			convo.say("Just type `/focus [put task here] for [put duration here]`\nLike this `/focus squash front-end bug for 45 min` or `/focus marketing report until 4pm`");
		});
	});

	/**
  * 		ACTUAL START SESSION FLOW
  * 		this will begin the start_session flow with user
  *
  * 			- start work session
  * 			- show and decide tasks to work on
  * 			- decide session duration
  */
	controller.on('begin_session_flow', function (bot, message) {
		var config = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
		var content = config.content;
		var changeTimeAndTask = config.changeTimeAndTask;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = void 0;
		var duration = void 0;
		var intent = void 0;
		var reminder = void 0;
		var datetime = void 0;
		var text = void 0;

		if (message) {
			SlackUserId = message.user;
			var _text = message.text;
			var _message$intentObject = message.intentObject.entities;
			var _intent = _message$intentObject.intent;
			var _reminder = _message$intentObject.reminder;
			var _duration = _message$intentObject.duration;
			var _datetime = _message$intentObject.datetime;

			if (!content) {
				if (_duration || _datetime) {
					content = _reminder ? _reminder[0].value : null;
				} else {
					// if no duration or datetime, we should just use entire text
					content = _text;
				}
			}
			bot.send({
				type: "typing",
				channel: message.channel
			});
		} else {
			SlackUserId = config.SlackUserId;
		}

		if (content) {
			// trim out if it starts with focus
			content = content.replace(/^focu[us]{1,3}/i, "").trim();
		}

		// hacky temp solution to prevent if user is just trying to enter focus with `lets focus`
		var containsFocus = new RegExp(/\bfocu[us]{1,3}\b/i);
		if (containsFocus.test(content) && content.length < 18) {
			content = false;
		}

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.tz;

			var UserId = user.id;
			var minutes = false;

			// we can only shortcut tz if we know message
			if (tz && message) {
				var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(message, tz);
				if (customTimeObject) {
					var now = (0, _momentTimezone2.default)().tz(tz);
					minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
				} else if (duration) {
					// if user puts in min and not picked up by customTimeObject
					config.minutes = witDurationToMinutes(duration);
				}
			}

			// check for an open session before starting flow
			user.getSessions({
				where: ['"open" = ?', true]
			}).then(function (sessions) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					// console.log(controller.tasks[0].convos);

					// have 5-minute exit time limit
					if (convo) {
						convo.task.timeLimit = 1000 * 60 * 5;
					}

					convo.sessionStart = {
						SlackUserId: SlackUserId,
						UserId: UserId,
						tz: tz,
						content: content,
						minutes: minutes
					};

					// check here if user is already in a session or not
					var currentSession = false;
					if (sessions.length > 0) {
						currentSession = sessions[0];
						convo.sessionStart.changeTimeAndTask = changeTimeAndTask;
					}

					convo.sessionStart.currentSession = currentSession;

					// entry point!
					(0, _startSessionFunctions.confirmTimeZoneExistsThenStartSessionFlow)(convo);
					convo.next();

					convo.on('end', function (convo) {
						var sessionStart = convo.sessionStart;
						var _convo$sessionStart = convo.sessionStart;
						var confirmNewSession = _convo$sessionStart.confirmNewSession;
						var content = _convo$sessionStart.content;
						var minutes = _convo$sessionStart.minutes;
						var tz = _convo$sessionStart.tz;


						console.log("\n\n\n end of start session ");
						console.log(sessionStart);
						console.log("\n\n\n");

						var startTime = (0, _momentTimezone2.default)();
						var endTime = (0, _momentTimezone2.default)().tz(tz).add(minutes, 'minutes');

						if (confirmNewSession) {

							// close all old sessions when creating new one
							_models2.default.Session.update({
								open: false,
								live: false
							}, {
								where: ['"Sessions"."UserId" = ? AND ("Sessions"."open" = ? OR "Sessions"."live" = ?)', UserId, true, true]
							}).then(function () {

								_models2.default.Session.create({
									UserId: UserId,
									startTime: startTime,
									endTime: endTime,
									content: content
								}).then(function (session) {

									// check if user has outstanding pings to others
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

											var endTimeString = endTime.format("h:mma");

											bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

												var text = ':palm_tree: You\'re now in a focused session on `' + content + '` until *' + endTimeString + '* :palm_tree:';
												var attachments = (0, _messageHelpers.getStartSessionOptionsAttachment)(pings);

												if (pings.length > 0) {
													(function () {

														// say session info, then provide ping options
														convo.say(text);

														// get slackNames and earliest endTime for pending fromUser pings
														var slackUserIds = [];
														var pingEndTime = (0, _momentTimezone2.default)().tz(tz);

														pings.forEach(function (ping) {
															var _ping$dataValues = ping.dataValues;
															var deliveryType = _ping$dataValues.deliveryType;
															var ToUser = _ping$dataValues.ToUser;
															var pingTime = _ping$dataValues.pingTime;
															var session = _ping$dataValues.session;

															if (!_lodash2.default.includes(slackUserIds, ToUser.dataValues.SlackUserId)) {

																slackUserIds.push(ToUser.dataValues.SlackUserId);
																var thisPingEndTime = void 0;
																if (pingTime) {
																	thisPingEndTime = (0, _momentTimezone2.default)(thisPingEndTime).tz(tz);
																} else if (deliveryType == _constants.constants.pingDeliveryTypes.sessionEnd && session) {
																	thisPingEndTime = (0, _momentTimezone2.default)(session.dataValues.endTime).tz(tz);
																}

																if (thisPingEndTime > pingEndTime) {
																	pingEndTime = thisPingEndTime;
																}
															}
														});

														// cant be deferred past my own session end!
														if (endTime < pingEndTime) {
															pingEndTime = endTime;
														}

														var pingEndTimeString = pingEndTime.format("h:mma");
														var slackNamesString = (0, _messageHelpers.commaSeparateOutStringArray)(slackUserIds, { SlackUserIds: true });

														var outstandingPingText = pings.length == 1 ? 'an outstanding ping' : 'outstanding pings';
														text = 'You also have ' + outstandingPingText + ' for ' + slackNamesString + ' that will start a conversation for you at or before ' + pingEndTimeString;
														convo.say({
															text: text,
															attachments: attachments
														});
													})();
												} else {
													// just start the session
													convo.say({
														text: text,
														attachments: attachments
													});
												}
											});
										});
									});
								});
							});
						}
					});
				});
			});
		});
	});

	/**
  * 		SEND PING SOONER FLOW
  * 		this is for sessions where ping wants to get sent as
  * 		soon as ToUser is done with session
  * 		this is the default when you enter a session
  */

	controller.on('send_sooner_flow', function (bot, message) {

		var SlackUserId = message.user;
		var text = message.text;


		bot.send({
			type: "typing",
			channel: message.channel
		});

		// un-defer all pings from this user
		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.tz;

			var UserId = user.id;

			_models2.default.Session.find({
				where: {
					UserId: UserId,
					live: true,
					open: true
				}
			}).then(function (session) {

				if (session) {
					session.update({
						superFocus: false
					}).then(function (session) {
						var _session$dataValues = session.dataValues;
						var endTime = _session$dataValues.endTime;
						var content = _session$dataValues.content;

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

								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

									var text = ':palm_tree: You\'re in a focused session on `' + content + '` until *' + endTimeString + '* :palm_tree:';
									var attachments = (0, _messageHelpers.getStartSessionOptionsAttachment)(pings);

									if (pings.length > 0) {
										(function () {
											// success in sendSooner!

											var config = { customOrder: true, order: ['deferPing', 'endSession'] };
											attachments = (0, _messageHelpers.getStartSessionOptionsAttachment)(pings, config);

											// get slackNames and earliest endTime for pending fromUser pings
											var slackUserIds = [];
											var pingEndTime = (0, _momentTimezone2.default)().tz(tz);

											pings.forEach(function (ping) {
												var _ping$dataValues2 = ping.dataValues;
												var deliveryType = _ping$dataValues2.deliveryType;
												var ToUser = _ping$dataValues2.ToUser;
												var pingTime = _ping$dataValues2.pingTime;
												var session = _ping$dataValues2.session;

												if (!_lodash2.default.includes(slackUserIds, ToUser.dataValues.SlackUserId)) {

													slackUserIds.push(ToUser.dataValues.SlackUserId);
													var thisPingEndTime = void 0;
													if (pingTime) {
														thisPingEndTime = (0, _momentTimezone2.default)(thisPingEndTime).tz(tz);
													} else if (deliveryType == _constants.constants.pingDeliveryTypes.sessionEnd && session) {
														thisPingEndTime = (0, _momentTimezone2.default)(session.dataValues.endTime).tz(tz);
													}

													if (thisPingEndTime > pingEndTime) {
														pingEndTime = thisPingEndTime;
													}
												}
											});

											// deferred ping cant be past endTime!
											if (endTimeObject < pingEndTime) {
												pingEndTime = endTimeObject;
											}

											var pingEndTimeString = pingEndTime.format("h:mma");
											var slackNamesString = (0, _messageHelpers.commaSeparateOutStringArray)(slackUserIds, { SlackUserIds: true });

											var outstandingPingText = pings.length == 1 ? 'Your ping' : 'Your pings';
											text = outstandingPingText + ' for ' + slackNamesString + '  will be delivered at or before ' + pingEndTimeString + '. Until then, good luck with `' + content + '`! :fist:';

											convo.say({
												text: text,
												attachments: attachments
											});
										})();
									} else {
										// just continue the session
										convo.say({
											text: text,
											attachments: attachments
										});
									}
								});
							});
						});
					});
				} else {
					(0, _index2.notInSessionWouldYouLikeToStartOne)({ bot: bot, SlackUserId: SlackUserId, controller: controller });
				}
			});
		});
	});

	/**
  * 		This is defer ping flow
  * 		it will make session into `superFocus` mode (to be renamed)
  * 		that means it will deferPings until after the session
  */
	controller.on('defer_ping_flow', function (bot, message) {

		var SlackUserId = message.user;
		var text = message.text;


		bot.send({
			type: "typing",
			channel: message.channel
		});

		// defer all pings from this user
		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.tz;

			var UserId = user.id;

			_models2.default.Session.find({
				where: {
					UserId: UserId,
					live: true,
					open: true
				}
			}).then(function (session) {

				if (session) {
					session.update({
						superFocus: true
					}).then(function (session) {
						var _session$dataValues2 = session.dataValues;
						var endTime = _session$dataValues2.endTime;
						var content = _session$dataValues2.content;

						var endTimeObject = (0, _momentTimezone2.default)(endTime).tz(tz);
						var endTimeString = endTimeObject.format("h:mma");

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							var text = ':palm_tree: I’ll follow up with you to send your message after your focused session on `' + content + '` ends at *' + endTimeString + '*. Good luck! :palm_tree:';
							var attachments = [{
								attachment_type: 'default',
								callback_id: "DEFERRED_PING_SESSION_OPTIONS",
								fallback: "Good luck with your focus session!",
								actions: [{
									name: _constants.buttonValues.sendSooner.name,
									text: "Send Sooner",
									value: _constants.buttonValues.sendSooner.value,
									type: "button"
								}, {
									name: _constants.buttonValues.endSession.name,
									text: "End Session",
									value: _constants.buttonValues.endSession.value,
									type: "button"
								}]
							}];

							convo.say({
								text: text,
								attachments: attachments
							});
						});
					});
				} else {
					(0, _index2.notInSessionWouldYouLikeToStartOne)({ bot: bot, SlackUserId: SlackUserId, controller: controller });
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

var _startSessionFunctions = require('./startSessionFunctions');

var _messageHelpers = require('../../lib/messageHelpers');

var _index2 = require('./index');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=startSession.js.map