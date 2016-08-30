'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// User explicitly wants to finish session early (wit intent)
	controller.hears(['end_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		/**
   * 			check if user has open session (should only be one)
   * 					if yes, trigger finish and end_session flow
   * 			  	if no, reply with confusion & other options
   */

		var SlackUserId = message.user;
		var endSessionType = _constants.constants.endSessionTypes.endSessionEarly;

		var config = { SlackUserId: SlackUserId, endSessionType: endSessionType };

		// no open sessions
		bot.send({
			type: "typing",
			channel: message.channel
		});

		setTimeout(function () {
			controller.trigger('end_session_flow', [bot, config]);
		}, 800);
	});

	/**
  * 		User has confirmed to ending session
  * 		This will immediately close the session, then move to
  * 		specified "post session" options
  */
	controller.on('end_session_flow', function (bot, config) {

		// pingInfo only relevant when endSessionType == `endByPingToUserId`
		var SlackUserId = config.SlackUserId;
		var endSessionType = config.endSessionType;
		var pingInfo = config.pingInfo;


		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var tz = user.tz;

			var UserId = user.id;

			user.getSessions({
				where: ['"open" = ?', true],
				order: '"Session"."createdAt" DESC'
			}).then(function (sessions) {

				var session = sessions[0] || false;

				/*
    * 	1. get all the `endSession` pings for ToUserId 
    * 	2. get all the live sessions for FromUserId (pingers)
    * 	3. match up sessions with pings into `pingContainer` (`pingContainer.ping` && `pingContainer.session`)
    * 	4. run logic based on whether ping has session
    */
				_models2.default.Ping.findAll({
					where: ['("Ping"."ToUserId" = ? OR "Ping"."FromUserId" = ?) AND "Ping"."live" = ? AND "Ping"."deliveryType" = ?', UserId, UserId, true, _constants.constants.pingDeliveryTypes.sessionEnd],
					include: [{ model: _models2.default.User, as: 'FromUser' }, { model: _models2.default.User, as: 'ToUser' }, _models2.default.PingMessage],
					order: '"Ping"."createdAt" ASC'
				}).then(function (pings) {

					// this object holds pings in relation to the UserId of the session that just ended!
					// fromUser are pings that the user sent out
					// toUser are pings that got sent to the user
					// need to batch by unique fromUser <=> toUser combinations
					var pingContainers = {
						fromUser: { toUser: {} },
						toUser: { fromUser: {} }
					};

					// get all the sessions associated with pings that come FromUser
					var pingerSessionPromises = [];

					pings.forEach(function (ping) {
						var FromUserId = ping.FromUserId;
						var ToUserId = ping.ToUserId;

						pingerSessionPromises.push(_models2.default.Session.find({
							where: {
								UserId: [FromUserId, ToUserId],
								live: true,
								open: true
							},
							include: [_models2.default.User]
						}));
					});

					Promise.all(pingerSessionPromises).then(function (pingerSessions) {

						// create the pingContainer by matching up `ping` with live `session`. then group it in the appropriate place in pingContainers
						// if no live session, `session` will be false
						pings.forEach(function (ping) {

							var pingFromUserId = ping.dataValues.FromUserId;
							var pingToUserId = ping.dataValues.ToUserId;

							// these are pings from user who just ended ession
							if (pingFromUserId == UserId) {
								(function () {

									var pingContainer = pingContainers.fromUser.toUser[pingToUserId] || { session: false, pings: [] };

									pingerSessions.forEach(function (pingerSession) {
										console.log(pingerSession);
										var pingerSessionUserId = pingerSession.dataValues.UserId;
										console.log(pingerSessionUserId);
										console.log(pingerSession);
										if (pingerSession && pingToUserId == pingerSessionUserId) {
											// recipient of ping is in session
											pingContainer.session = pingerSession;
											return;
										}
									});

									pingContainer.user = ping.dataValues.ToUser;
									pingContainer.pings.push(ping);
									pingContainers.fromUser.toUser[pingToUserId] = pingContainer;
								})();
							} else if (pingToUserId == UserId) {
								(function () {
									// these are pings to user who just ended session

									var pingContainer = pingContainers.fromUser.toUser[pingToUserId] || { session: false, pings: [] };

									pingerSessions.forEach(function (pingerSession) {
										var pingerSessionUserId = pingerSession.dataValues.UserId;
										if (pingerSession && pingFromUserId == pingerSessionUserId) {
											pingContainer.session = pingerSession;
											return;
										}
									});

									pingContainer.user = ping.dataValues.FromUser;
									pingContainer.pings.push(ping);
									pingContainers.toUser.fromUser[pingFromUserId] = pingContainer;
								})();
							}
						});

						// attach only the relevant pingContainers (ones where FromUserId is not in live session or `superFocus` session)
						for (var fromUserId in pingContainers.toUser.fromUser) {

							if (!pingContainers.toUser.fromUser.hasOwnProperty(fromUserId)) {
								continue;
							}

							// delete if in superFocus session
							if (pingContainers.toUser.fromUser[fromUserId].session && pingContainers.toUser.fromUser[fromUserId].session.dataValues.superFocus) {
								delete pingContainers.toUser.fromUser[fromUserId];
							}
						}

						// this needs to now be split up into 2:
						// 1) batch up ping messages together
						// 2) send batchedPings through this `forEach` method

						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

							if (err) {
								console.log('\n\n\n error! ' + err + ' \n\n\n');
								return;
							}

							// have 5-minute exit time limit
							convo.task.timeLimit = 1000 * 60 * 5;

							convo.sessionEnd = {
								UserId: UserId,
								SlackUserId: SlackUserId,
								tz: tz,
								pingContainers: pingContainers, // all `endSession` pings to handle
								endSessionType: endSessionType,
								pingInfo: pingInfo
							};

							// end the session if it exists!
							if (session) {

								var now = (0, _momentTimezone2.default)();
								var endTime = (0, _momentTimezone2.default)(session.dataValues.endTime);
								if (now < endTime) endTime = now;

								// END THE SESSION HERE
								session.update({
									open: false,
									live: false,
									endTime: endTime
								}).then(function (session) {

									convo.sessionEnd.session = session;

									_models2.default.Session.update({
										open: false,
										live: false
									}, {
										where: ['"Sessions"."UserId" = ? AND ("Sessions"."open" = ? OR "Sessions"."live" = ?)', UserId, true, true]
									});

									// start the flow after ending session
									(0, _endSessionFunctions.startEndSessionFlow)(convo);
								});
							} else {
								// go thru flow without session to end
								(0, _endSessionFunctions.startEndSessionFlow)(convo);
							}

							convo.on('end', function (convo) {

								// all the ping objects here are relevant!
								var _convo$sessionEnd = convo.sessionEnd;
								var pingContainers = _convo$sessionEnd.pingContainers;
								var endSessionType = _convo$sessionEnd.endSessionType;

								// pings queued for user who just ended this session

								pingContainers.toUser.fromUser.foreach;

								forEach(function (pingContainer) {
									var ping = pingContainer.ping;
									var _pingContainer$ping$d = pingContainer.ping.dataValues;
									var FromUser = _pingContainer$ping$d.FromUser;
									var ToUser = _pingContainer$ping$d.ToUser;
									var session = pingContainer.session;


									ping.getPingMessages({}).then(function (pingMessages) {

										ping.update({
											live: false
										}).then(function () {

											// no live session, kick off the convo
											var fromUserConfig = {
												UserId: FromUser.dataValues.id,
												SlackUserId: FromUser.dataValues.SlackUserId,
												TeamId: FromUser.dataValues.TeamId
											};
											var toUserConfig = {
												UserId: ToUser.dataValues.id,
												SlackUserId: ToUser.dataValues.SlackUserId,
												TeamId: ToUser.dataValues.TeamId
											};
											var pingConfig = {
												deliveryType: _constants.constants.pingDeliveryTypes.sessionEnd,
												pingMessages: pingMessages
											};

											// send pings that are for ToUser!
											(0, _pingFunctions.sendPing)(fromUserConfig, toUserConfig, pingConfig);

											// put FromUser of these pings thru endSession flow!
											var endSessionConfig = {
												endSessionType: _constants.constants.endSessionTypes.endByPingToUserId,
												pingInfo: {
													PingId: ping.dataValues.id,
													FromUser: FromUser,
													ToUser: ToUser,
													session: session, // did this come while in session?
													endSessionType: endSessionType // whether OG user ended early or sessionTimerUp
												},
												SlackUserId: FromUser.dataValues.SlackUserId
											};
											if (thisPingEndedUsersSessionsTogether) {
												endSessionConfig.pingInfo.thisPingEndedUsersSessionsTogether = thisPingEndedUsersSessionsTogether;
											}
											controller.trigger('end_session_flow', [bot, endSessionConfig]);
										});
									});
								});

								// pings queued by user who just ended this session
								pingContainers.fromUser.toUser;

								forEach(function (pingContainer) {
									var ping = pingContainer.ping;
									var _pingContainer$ping$d2 = pingContainer.ping.dataValues;
									var FromUser = _pingContainer$ping$d2.FromUser;
									var ToUser = _pingContainer$ping$d2.ToUser;
									var session = pingContainer.session;

									// only send the messages here when ToUser is not in a session

									ping.getPingMessages({}).then(function (pingMessages) {
										if (!session) {
											// no live session, kick off the convo
											var fromUserConfig = {
												UserId: FromUser.dataValues.id,
												SlackUserId: FromUser.dataValues.SlackUserId,
												TeamId: FromUser.dataValues.TeamId
											};
											var toUserConfig = {
												UserId: ToUser.dataValues.id,
												SlackUserId: ToUser.dataValues.SlackUserId,
												TeamId: ToUser.dataValues.TeamId
											};
											var pingConfig = {
												deliveryType: _constants.constants.pingDeliveryTypes.sessionEnd,
												pingMessages: pingMessages
											};

											// send pings that are for ToUser!
											(0, _pingFunctions.sendPing)(fromUserConfig, toUserConfig, pingConfig);
										}
									});
								});
							});
						});
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

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _endSessionFunctions = require('./endSessionFunctions');

var _pingFunctions = require('../pings/pingFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=endSession.js.map