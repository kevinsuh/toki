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

		controller.trigger('end_session_flow', [bot, config]);
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
		var mutualSessionEndingPings = config.mutualSessionEndingPings;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {
			var tz = user.tz;
			var accessToken = user.accessToken;

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

						pingerSessionPromises.push(_models2.default.Session.findAll({
							where: {
								UserId: [FromUserId, ToUserId],
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

										if (pingerSession && pingToUserId == pingerSession.dataValues.UserId) {
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
										if (pingerSession && pingFromUserId == pingerSession.dataValues.UserId) {
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

						// this session is the one that's ended. find the pings where FromUser and ToUser are both going to be ending each other's sessions
						// if this is the case (this is if FromUser <=> ToUser, and both are not in `superFocus` mode)
						// the hard work has been done up to this point. all the pings where the FromUser is in `superFocus` has gotten excluded
						// thus, the only thing needed up to this point is to see which pings are toUser <=> fromUser
						// once we match those, update the pings as false, remove them from pings array, then communicate that this convo has gotten started
						// **** ~~ REFACTOR THIS TO `_.forIn` USING LODASH EVENTUALLY
						if (!mutualSessionEndingPings) {

							mutualSessionEndingPings = {};

							for (var toUserId in pingContainers.fromUser.toUser) {

								if (!pingContainers.fromUser.toUser.hasOwnProperty(toUserId)) {
									continue;
								}

								var fromPingContainer = pingContainers.fromUser.toUser[toUserId];
								var toPingContainer = pingContainers.toUser.fromUser[toUserId];
								// this means FromUser <=> ToUser pings (mutually session ending)
								if (toPingContainer) {

									// this paradigm is more about sessions than pings
									// this is FROM the user who ended the session, TO the user who got session ended
									var fromSessionEndingUser = user;
									var fromSessionEndingUserPings = fromPingContainer.pings;
									var toSessionEndingUser = toPingContainer.user;
									var toSessionEndingUserPings = toPingContainer.pings;

									mutualSessionEndingPings = {
										fromSessionEndingUser: fromSessionEndingUser,
										fromSessionEndingUserPings: fromSessionEndingUserPings,
										toSessionEndingUser: toSessionEndingUser,
										toSessionEndingUserPings: toSessionEndingUserPings
									};

									// it is held in mutualSessionEndingPings now, you can delete from ping containers
									delete pingContainers.fromUser.toUser[toUserId];
									delete pingContainers.toUser.fromUser[toUserId];
								}
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
								user: user,
								pingContainers: pingContainers,
								endSessionType: endSessionType,
								pingInfo: pingInfo,
								mutualSessionEndingPings: mutualSessionEndingPings
							};

							if (accessToken) {
								// turn off snooze
								bot.api.dnd.endSnooze({
									token: accessToken
								}, function (err, res) {

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
								});
							}

							convo.on('end', function (convo) {

								/**
         * 		THIS IS WHERE THE SHARED CONVOS WILL BEGIN
         */

								// all the ping objects here are relevant!
								var _convo$sessionEnd = convo.sessionEnd;
								var pingContainers = _convo$sessionEnd.pingContainers;
								var endSessionType = _convo$sessionEnd.endSessionType;
								var pingInfo = _convo$sessionEnd.pingInfo;
								var user = _convo$sessionEnd.user;
								var session = _convo$sessionEnd.session;

								// put the mutual session ending pings back
								// onto the matching pingContainer now, so they
								// will be sent into shared convo

								if (mutualSessionEndingPings) {
									var _mutualSessionEndingP = mutualSessionEndingPings;
									var _fromSessionEndingUser = _mutualSessionEndingP.fromSessionEndingUser;
									var _fromSessionEndingUserPings = _mutualSessionEndingP.fromSessionEndingUserPings;
									var _toSessionEndingUser = _mutualSessionEndingP.toSessionEndingUser;
									var _toSessionEndingUserPings = _mutualSessionEndingP.toSessionEndingUserPings;

									// from user who ended session

									if (_fromSessionEndingUser && _fromSessionEndingUser.dataValues.SlackUserId == SlackUserId && _fromSessionEndingUserPings.length > 0) {

										pingContainers.fromUser.toUser[_toSessionEndingUser.dataValues.id] = { session: false, user: _toSessionEndingUser, pings: _fromSessionEndingUserPings };
										pingContainers.toUser.fromUser[_toSessionEndingUser.dataValues.id] = { session: false, user: _toSessionEndingUser, pings: _toSessionEndingUserPings };

										mutualSessionEndingPings.fromSessionEndingUserPings = [];
										mutualSessionEndingPings.toSessionEndingUserPings = [];
									}
								}

								// pings queued to this user who just ended this session

								var _loop = function _loop(_fromUserId) {

									if (!pingContainers.toUser.fromUser.hasOwnProperty(_fromUserId)) {
										return 'continue';
									}

									var pingContainer = pingContainers.toUser.fromUser[_fromUserId];
									var FromUser = pingContainer.user;
									var session = pingContainer.session;
									var pings = pingContainer.pings;

									var deliveryType = _constants.constants.pingDeliveryTypes.sessionEnd;

									// update then send
									var pingPromises = [];
									pings.forEach(function (ping) {
										pingPromises.push(_models2.default.Ping.update({
											live: false
										}, {
											where: { id: ping.dataValues.id }
										}));
									});

									// if sent, turn ping off and continue
									if ((0, _pingFunctions.sendGroupPings)(pings, deliveryType)) {

										Promise.all(pingPromises).then(function (value) {

											// if previous ping is what ended session together,
											// no need to put FromUser back through endSessionFlow
											// because FromUser's session has just gotten ended
											if (pingInfo && pingInfo.thisPingEndedUsersSessionsTogether && pingInfo.FromUser.dataValues.SlackUserId == FromUser.dataValues.SlackUserId) {
												return;
											} else {

												// else, put FromUser of these pings thru endSession flow!
												var endSessionConfig = {
													endSessionType: _constants.constants.endSessionTypes.endByPingToUserId,
													pingInfo: {
														FromUser: FromUser,
														ToUser: user,
														endSessionType: endSessionType // whether OG user ended early or sessionTimerUp
													},
													SlackUserId: FromUser.dataValues.SlackUserId,
													mutualSessionEndingPings: mutualSessionEndingPings
												};

												if (pingContainer.thisPingEndedUsersSessionsTogether) {
													endSessionConfig.pingInfo.thisPingEndedUsersSessionsTogether = thisPingEndedUsersSessionsTogether;
												}

												controller.trigger('end_session_flow', [bot, endSessionConfig]);
											}
										});
									}
								};

								for (var _fromUserId in pingContainers.toUser.fromUser) {
									var _ret3 = _loop(_fromUserId);

									if (_ret3 === 'continue') continue;
								}

								// pings from this end_session user to other users
								for (var _toUserId in pingContainers.fromUser.toUser) {

									if (!pingContainers.fromUser.toUser.hasOwnProperty(_toUserId)) {
										continue;
									}

									var _pingContainer = pingContainers.fromUser.toUser[_toUserId];
									var ToUser = _pingContainer.user;
									var _session = _pingContainer.session;
									var _pings = _pingContainer.pings;

									var deliveryType = _constants.constants.pingDeliveryTypes.sessionEnd;

									// if ToUser is not in session,
									// send pings that are from this user!
									if (!_session) {
										(function () {

											var pingPromises = [];
											_pings.forEach(function (ping) {
												pingPromises.push(_models2.default.Ping.update({
													live: false
												}, {
													where: { id: ping.dataValues.id }
												}));
											});

											if ((0, _pingFunctions.sendGroupPings)(_pings, deliveryType)) {
												Promise.all(pingPromises);
											}
										})();
									}
								}

								// update the dashboard for each channel user is in
								bot.api.channels.list({}, function (err, response) {

									var BotSlackUserId = bot.identity.id;

									if (!err) {
										var channels = response.channels;


										channels.forEach(function (channel) {
											var id = channel.id;
											var name = channel.name;
											var is_channel = channel.is_channel;
											var topic = channel.topic;
											var purpose = channel.purpose;
											var members = channel.members;


											var hasBotSlackUserId = false;
											var hasMemberSlackUserId = false;

											_lodash2.default.some(members, function (member) {
												if (member == SlackUserId) {
													hasBotSlackUserId = true;
												} else if (member == BotSlackUserId) {
													hasMemberSlackUserId = true;
												}
											});

											if (hasBotSlackUserId && hasMemberSlackUserId) {
												(0, _slackHelpers.updateDashboardForChannelId)(bot, id);
											}
										});
									} else {
										console.log('\n\n\n ~~ error in listing channel:');
										console.log(err);
									}
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

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _endSessionFunctions = require('./endSessionFunctions');

var _pingFunctions = require('../pings/pingFunctions');

var _slackHelpers = require('../../lib/slackHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=endSession.js.map