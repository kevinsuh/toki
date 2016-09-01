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
		var _message$intentObject = message.intentObject.entities;
		var intent = _message$intentObject.intent;
		var reminder = _message$intentObject.reminder;
		var duration = _message$intentObject.duration;
		var datetime = _message$intentObject.datetime;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		var SlackUserId = message.user;
		var text = message.text;


		var config = {
			SlackUserId: SlackUserId,
			message: message
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			_models2.default.User.find({
				where: { SlackUserId: SlackUserId }
			}).then(function (user) {
				var tz = user.tz;


				if (tz) {
					var customTimeObject = (0, _messageHelpers.witTimeResponseToTimeZoneObject)(message, tz);
					if (customTimeObject) {
						var now = (0, _momentTimezone2.default)().tz(tz);
						var minutes = Math.round(_momentTimezone2.default.duration(customTimeObject.diff(now)).asMinutes());
						config.minutes = minutes;
					}
				}
				controller.trigger('begin_session_flow', [bot, config]);
			});
		}, 750);
	});

	/**
  * 		ACTUAL START SESSION FLOW
  * 		this will begin the start_session flow with user
  *
  * 			- start work session
  * 			- show and decide tasks to work on
  * 			- decide session duration
  */
	controller.on('begin_session_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var content = config.content;
		var minutes = config.minutes;
		var changeTimeAndTask = config.changeTimeAndTask;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

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

											pingerSessionPromises.push(_models2.default.Session.find({
												where: {
													UserId: ToUserId,
													live: true,
													open: true
												},
												include: [_models2.default.User]
											}));
										});

										Promise.all(pingerSessionPromises).then(function (pingerSessions) {

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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=startSession.js.map