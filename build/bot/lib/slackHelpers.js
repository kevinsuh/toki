'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.updateDashboardForChannelId = updateDashboardForChannelId;
exports.checkIsNotAlreadyInConversation = checkIsNotAlreadyInConversation;

var _constants = require('./constants');

var _messageHelpers = require('./messageHelpers');

var _nlp_compromise = require('nlp_compromise');

var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
 */

function updateDashboardForChannelId(bot, ChannelId) {
	var config = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];


	var BotSlackUserId = bot.identity.id;
	var statusUpdate = config.statusUpdate;


	_models2.default.Channel.find({
		where: { ChannelId: ChannelId }
	}).then(function (channel) {
		var ChannelId = channel.ChannelId;
		var tz = channel.tz;
		var TeamId = channel.TeamId;


		if (!tz || !TeamId) {
			console.log('\n\n\n ERROR... NO TZ OR TEAMID FOR CHANNEL: ' + ChannelId + ' | ' + TeamId);
			return;
		}

		// get channel info!
		bot.api.channels.info({
			channel: ChannelId
		}, function (err, response) {
			var channel = response.channel;
			var _response$channel = response.channel;
			var id = _response$channel.id;
			var name = _response$channel.name;
			var members = _response$channel.members;


			var zoneAbbrString = (0, _momentTimezone2.default)().tz(tz).zoneAbbr(); // ex. EDT
			var todayString = (0, _momentTimezone2.default)().tz(tz).format('MMMM Do YYYY'); // ex. September 6th, 2016
			var text = ':raised_hands: *Team Pulse for ' + todayString + '* :raised_hands:';
			var attachments = [];

			_models2.default.Team.find({
				where: ['"Team"."TeamId" = ?', TeamId]
			}).then(function (team) {
				var accessToken = team.accessToken;


				if (!accessToken) {
					console.log('\n\n\n ERROR... NO ACCESS TOKEN FOR BOT: ' + accessToken);
					return;
				}

				var dashboardMemberSlackUserIds = [];
				members.forEach(function (MemberSlackUserId) {

					if (MemberSlackUserId != BotSlackUserId) {
						dashboardMemberSlackUserIds.push(MemberSlackUserId);
					}
				});

				if (dashboardMemberSlackUserIds.length == 0) {
					console.log('\n\n ~~ error no dashboard member slack user ids ~~ \n\n');;
					return;
				}

				_models2.default.User.findAll({
					where: ['"User"."SlackUserId" IN (?)', dashboardMemberSlackUserIds]
				}).then(function (users) {

					var sessionPromises = [];
					var dashboardUsers = {}; // by SlackUserId key i.e. dashboardUsers[`UI14242`] = {}

					users.forEach(function (user) {

						sessionPromises.push(_models2.default.Session.find({
							where: {
								UserId: user.dataValues.id,
								live: true,
								open: true
							},
							include: [_models2.default.User]
						}));
						dashboardUsers[user.dataValues.SlackUserId] = {
							session: false,
							user: user
						};
					});

					var userSessions = []; // unique sessions only
					Promise.all(sessionPromises).then(function (userSessions) {

						userSessions.forEach(function (userSession) {

							if (userSession && dashboardUsers[userSession.dataValues.User.SlackUserId]) {
								dashboardUsers[userSession.dataValues.User.SlackUserId].session = userSession;
							}
						});

						var titleOfDashboard = {
							mrkdwn_in: ["text", "fields"],
							callback_id: _constants.constants.dashboardCallBackId,
							fallback: 'Here\'s your team pulse!',
							fields: [{
								title: "Current Focus",
								short: true
							}, {
								title: 'Until (' + zoneAbbrString + ')',
								short: true
							}],
							color: _constants.colorsHash.white.hex
						};

						attachments = [titleOfDashboard];

						// iterate through dashboardUsers and put into alphabetized array
						var dashboardUsersArrayAlphabetical = [];
						_lodash2.default.forOwn(dashboardUsers, function (value, key) {
							var session = value.session;

							if (session) {
								// value is the object that has value.user and value.session
								dashboardUsersArrayAlphabetical.push(value);
							}
						});

						dashboardUsersArrayAlphabetical.sort(function (a, b) {

							var nameA = a.user.dataValues.SlackName;
							var nameB = b.user.dataValues.SlackName;
							return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
						});

						dashboardUsersArrayAlphabetical.forEach(function (dashboardUser) {
							var session = dashboardUser.session;
							var _dashboardUser$user$d = dashboardUser.user.dataValues;
							var SlackUserId = _dashboardUser$user$d.SlackUserId;
							var SlackName = _dashboardUser$user$d.SlackName;
							var TeamId = _dashboardUser$user$d.TeamId;


							var sessionContent = void 0;
							var sessionTime = void 0;
							var sessionColor = void 0;

							if (session) {
								sessionContent = '`' + session.dataValues.content + '`';
								sessionTime = (0, _momentTimezone2.default)(session.dataValues.endTime).tz(tz).format("h:mma");
								sessionColor = _constants.colorsHash.toki_purple.hex;
							} else {
								sessionContent = '_No current focus_';
								sessionTime = '';
								sessionColor = _constants.colorsHash.grey.hex;
							}

							// alphabetize the 
							attachments.push({
								attachment_type: 'default',
								callback_id: "DASHBOARD_SESSION_INFO_FOR_USER",
								fallback: 'Here\'s the session info!',
								text: '<slack://user?team=' + TeamId + '&id=' + SlackUserId + '|@' + SlackName + '>',
								mrkdwn_in: ["text", "fields"],
								fields: [{
									value: sessionContent,
									short: true
								}, {
									value: sessionTime,
									short: true
								}],
								color: sessionColor,
								actions: [{
									name: "SEND_PING",
									text: "Collaborate Now",
									value: '{"collaborateNow": true, "collaborateNowSlackUserId": "' + SlackUserId + '"}',
									type: "button"
								}]
							});
						});

						var dashboardActions = {
							attachment_type: 'default',
							callback_id: _constants.constants.dashboardActions,
							fallback: 'Would you like to do something?',
							mrkdwn_in: ["text", "fields"],
							color: _constants.colorsHash.toki_yellow.hex,
							text: "_Would you like to do anything?_",
							actions: [{
								name: "SET_PRIORITY",
								text: "Let's Focus!",
								value: '{"setPriority": true}',
								type: "button"
							}]
						};
						attachments.push(dashboardActions);

						bot.api.channels.history({
							token: accessToken,
							channel: ChannelId
						}, function (err, response) {

							if (!err) {
								(function () {
									var messages = response.messages;

									var teamPulseDashboardMessage = false;
									var messageCount = 0;
									var updateMessage = ''; // this is the message that will trigger beating of team-pulse

									// iterate through messages to find
									// the `DASHBOARD_TEAM_PULSE` attachment
									_lodash2.default.some(messages, function (message) {

										// user is `SlackUserId`
										var user = message.user;
										var attachments = message.attachments;

										// find the most recent message of the team pulse (hopefully there is only 1)

										if (user == BotSlackUserId && attachments && attachments[0].callback_id == _constants.constants.dashboardCallBackId) {
											teamPulseDashboardMessage = message;
											return true;
										}

										messageCount++;
									});

									// if status update, send why you are pinging
									if (statusUpdate) {
										var startSession = statusUpdate.startSession;
										var SlackUserId = statusUpdate.SlackUserId;


										if (startSession) {

											var startSessionObject = dashboardUsers[SlackUserId];
											var session = startSessionObject.session;
											var user = startSessionObject.user;
											var _session$dataValues = session.dataValues;
											var content = _session$dataValues.content;
											var startTime = _session$dataValues.startTime;
											var endTime = _session$dataValues.endTime;
											var SlackName = user.dataValues.SlackName;


											var startTimeObject = (0, _momentTimezone2.default)(startTime);
											var endTimeObject = (0, _momentTimezone2.default)(endTime);
											var sessionMinutes = Math.round(_momentTimezone2.default.duration(endTimeObject.diff(startTimeObject)).asMinutes());
											var sessionDurationString = (0, _messageHelpers.convertMinutesToHoursString)(sessionMinutes);

											var endTimeString = (0, _momentTimezone2.default)(endTime).tz(tz).format("h:mma");
											updateMessage = '*Update*: <@' + SlackUserId + '> is working on `' + content + '` for ' + sessionDurationString + ' until *' + endTimeString + '*';
										}
									}

									// either update existing dashboard, or create new one if one doesn't exist

									if (teamPulseDashboardMessage) {
										(function () {

											// update the attachments with the session info!
											var _teamPulseDashboardMe = teamPulseDashboardMessage;
											var ts = _teamPulseDashboardMe.ts;

											var teamPulseDashboardMessageObject = {
												channel: ChannelId,
												ts: ts
											};

											// statusUpdate determines whether we send a new ping or not
											if (statusUpdate) {

												bot.api.chat.delete(teamPulseDashboardMessageObject, function (err, res) {

													if (!err) {

														var _config = {
															bot: bot,
															ChannelId: ChannelId,
															text: text,
															ts: ts,
															titleOfDashboard: titleOfDashboard,
															attachments: attachments,
															statusUpdate: statusUpdate,
															statusUpdateMessage: updateMessage,
															dashboardUsers: dashboardUsers
														};

														sendNewDashboardObject(_config);
													} else {
														console.log('\n\n error in status update portion of dashboard object');
														console.log(err);
													}
												});
											} else {

												// no statusUpdate => no ping, just update
												// i.e. `end_session` situation
												if (attachments.length < 3) {
													var noUsers = true;
													attachments.forEach(function (attachment) {
														var callback_id = attachment.callback_id;
														// double check that no users are in focus session

														if (callback_id == 'DASHBOARD_SESSION_INFO_FOR_USER') {
															noUsers = false;
														}
													});

													if (noUsers) {
														delete attachments[0].fields;
														attachments.forEach(function (attachment) {
															console.log(attachment);
															if (attachment.callback_id == _constants.constants.dashboardActions) {
																attachment.text = 'Start a focus session by clicking the button below :point_down:\nI’ll post what you’re working on here so your team knows what you’re focused on :dancers:\nI’ll also snooze your non-urgent notifications :palm_tree:';
															}
															teamPulseDashboardMessageObject.text = ' ';
														});
													}
												}

												teamPulseDashboardMessageObject.attachments = JSON.stringify(attachments);
												bot.api.chat.update(teamPulseDashboardMessageObject);
											}
										})();
									} else {

										// if no dashboard exists, just create a new one

										var _config2 = {
											bot: bot,
											ChannelId: ChannelId,
											text: text,
											ts: ts,
											titleOfDashboard: titleOfDashboard,
											attachments: attachments,
											statusUpdate: statusUpdate,
											statusUpdateMessage: updateMessage,
											dashboardUsers: dashboardUsers
										};

										sendNewDashboardObject(_config2);
									}
								})();
							} else {

								console.log('\n\n\n error in getting history of channel:');
								console.log(err);
							}
						});
					});
				});
			});
		});
	});
}

// send a new dashboard object with given config
function sendNewDashboardObject(config) {
	var bot = config.bot;
	var ChannelId = config.ChannelId;
	var text = config.text;
	var ts = config.ts;
	var titleOfDashboard = config.titleOfDashboard;
	var attachments = config.attachments;
	var statusUpdate = config.statusUpdate;
	var statusUpdateMessage = config.statusUpdateMessage;
	var dashboardUsers = config.dashboardUsers;


	bot.send({
		channel: ChannelId,
		text: text,
		attachments: [titleOfDashboard]
	}, function (err, response) {

		// send without attachments then update, in order to avoid @mention of users in focus sessions
		var ts = response.ts;
		var text = response.message.text;

		text = '' + text;
		var updateDashboardObject = {
			text: text,
			ts: ts,
			channel: ChannelId
		};

		// 1. if this is your status update, we will mark channel as read
		if (statusUpdate) {
			var SlackUserId = statusUpdate.SlackUserId;
			var user = dashboardUsers[SlackUserId].user;


			if (user.dataValues) {

				bot.api.channels.mark({
					token: user.dataValues.accessToken,
					channel: ChannelId,
					ts: ts
				}, function (err, res) {
					console.log('\n\n success on mark');
					console.log(err);
					console.log(res);
				});
			}

			// put status update msg at bottom
			attachments.push({
				attachment_type: 'default',
				callback_id: "STATUS_UPDATE_TO_DASHBOARD",
				fallback: 'Here\'s the status update!',
				pretext: statusUpdateMessage,
				mrkdwn_in: ["pretext"]
			});
		}

		// 2. update dashboard msg
		updateDashboardObject.attachments = JSON.stringify(attachments);

		bot.api.chat.update(updateDashboardObject);
	});
}

function checkIsNotAlreadyInConversation(controller, SlackUserId) {

	var valid = true;

	// at start of convo,
	// check if user is in conversation
	// if so, return and do not do another convo here.
	if (controller.tasks && controller.tasks.length > 0) {
		(function () {

			var userConversationsCount = 0;

			_lodash2.default.some(controller.tasks, function (task) {
				var convos = task.convos;


				_lodash2.default.some(convos, function (convo) {
					var source_message = convo.source_message;

					console.log(source_message);

					if (source_message.channel && source_message.user && source_message.user == SlackUserId) {
						userConversationsCount++;
						return true;
					}
				});
			});

			if (userConversationsCount > 0) {
				console.log('\n\n ~~ user is in a convo already!!! this conversation cannot happen due to double conversation ~~ \n\n');
				valid = false;
			}
		})();
	}

	return valid;
}
//# sourceMappingURL=slackHelpers.js.map