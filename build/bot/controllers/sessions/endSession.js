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

						// this object holds pings in relation to the UserId of the session that just ended!
						// fromUser are pings that the user sent out
						// toUser are pings that got sent to the user
						// need to batch by unique fromUser <=> toUser combinations
						var pingContainers = {
							fromUser: { toUser: {} },
							toUser: { fromUser: {} }
						};

						// create the pingContainer by matching up `ping` with live `session`. then group it in the appropriate place in pingContainers
						// if no live session, `session` will be false
						pings.forEach(function (ping) {

							var pingFromUserId = ping.dataValues.FromUserId;
							var pingToUserId = ping.dataValues.ToUserId;

							// these are pings from user who just ended ession
							if (pingFromUserId == UserId) {
								(function () {

									// create new container if it doesn't exist
									var pingContainer = pingContainers.fromUser.toUser[pingToUserId] || { session: false, pings: [] };

									pingerSessions.forEach(function (pingerSession) {
										var pingerSessionUserId = pingerSession.dataValues.UserId;
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

									// create new if doesn't exist
									var pingContainer = pingContainers.toUser.fromUser[pingFromUserId] || { session: false, pings: [] };

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

						// strip out the irrelevant pingContainers (ones where FromUserId is in live, `superFocus` session)
						for (var fromUserId in pingContainers.toUser.fromUser) {

							if (!pingContainers.toUser.fromUser.hasOwnProperty(fromUserId)) {
								continue;
							}

							// delete if in superFocus session
							if (pingContainers.toUser.fromUser[fromUserId].session && pingContainers.toUser.fromUser[fromUserId].session.dataValues.superFocus) {
								delete pingContainers.toUser.fromUser[fromUserId];
							}
						}

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
								pingContainers: pingContainers,
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
								var pingInfo = _convo$sessionEnd.pingInfo;

								// pings queued to this user who just ended this session

								for (var _fromUserId in pingContainers.toUser.fromUser) {

									if (!pingContainers.toUser.fromUser.hasOwnProperty(_fromUserId)) {
										continue;
									}

									var pingContainer = pingContainers.toUser.fromUser[_fromUserId];
									var FromUser = pingContainer.user;
									var _session = pingContainer.session;
									var _pings = pingContainer.pings;

									var deliveryType = _constants.constants.pingDeliveryTypes.sessionEnd;

									// pings is all of the pings stored to this user from user
									sendPings(_pings, deliveryType);

									// if previous ping is what ended session together,
									// no need to put FromUser back through endSessionFlow
									// because FromUser's session has just gotten ended
									if (pingInfo && pingInfo.thisPingEndedUsersSessionsTogether && pingInfo.SlackUserId == FromUser.dataValues.SlackUserId) {
										continue;
									}

									// else, put FromUser of these pings thru endSession flow!
									var endSessionConfig = {
										endSessionType: _constants.constants.endSessionTypes.endByPingToUserId,
										pingInfo: {
											PingId: ping.dataValues.id,
											FromUser: FromUser,
											ToUser: ToUser,
											session: _session, // did this come while in session?
											endSessionType: endSessionType // whether OG user ended early or sessionTimerUp
										},
										SlackUserId: FromUser.dataValues.SlackUserId
									};

									if (pingContainer.thisPingEndedUsersSessionsTogether) {
										endSessionConfig.pingInfo.thisPingEndedUsersSessionsTogether = thisPingEndedUsersSessionsTogether;
									}
									controller.trigger('end_session_flow', [bot, endSessionConfig]);
								}

								// pings from this end_session user to other users
								for (var toUserId in pingContainers.fromUser.toUser) {

									if (!pingContainers.fromUser.toUser.hasOwnProperty(toUserId)) {
										continue;
									}

									var _pingContainer = pingContainers.fromUser.toUser[toUserId];
									var _ToUser = _pingContainer.user;
									var _session2 = _pingContainer.session;
									var _pings2 = _pingContainer.pings;

									var _deliveryType = _constants.constants.pingDeliveryTypes.sessionEnd;

									// if ToUser is not in session,
									// send pings that are from this user!
									if (!_session2) {
										sendPings(_pings2, _deliveryType);
									}
								}
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