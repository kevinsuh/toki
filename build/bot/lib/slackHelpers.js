'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.updateDashboardForChannelId = updateDashboardForChannelId;
exports.checkIsNotAlreadyInConversation = checkIsNotAlreadyInConversation;

var _constants = require('./constants');

var _nlp_compromise = require('nlp_compromise');

var _nlp_compromise2 = _interopRequireDefault(_nlp_compromise);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function updateDashboardForChannelId(bot, ChannelId) {
	var config = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];


	var BotSlackUserId = bot.identity.id;

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

						attachments = [{
							mrkdwn_in: ["text", "fields"],
							callback_id: _constants.constants.dashboardCallBackId,
							fallback: 'Here\'s your team pulse!',
							fields: [{
								title: "Currently Doing",
								short: true
							}, {
								title: 'Until (' + zoneAbbrString + ')',
								short: true
							}],
							color: _constants.colorsHash.white.hex
						}];

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
							var SlackUserId = dashboardUser.user.dataValues.SlackUserId;


							var sessionContent = void 0;
							var sessionTime = void 0;
							var sessionColor = void 0;

							if (session) {
								sessionContent = '`' + session.dataValues.content + '`';
								sessionTime = (0, _momentTimezone2.default)(session.dataValues.endTime).tz(tz).format("h:mma");
								sessionColor = _constants.colorsHash.toki_purple.hex;
							} else {
								sessionContent = '_No status set_';
								sessionTime = '';
								sessionColor = _constants.colorsHash.grey.hex;
							}

							// alphabetize the 
							attachments.push({
								attachment_type: 'default',
								callback_id: "DASHBOARD_SESSION_INFO_FOR_USER",
								fallback: 'Here\'s the session info!',
								text: '<@' + SlackUserId + '>',
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
									text: "Send Message",
									value: '{"pingUser": true, "PingToSlackUserId": "' + SlackUserId + '"}',
									type: "button"
								}]
							});
						});

						attachments.push({
							attachment_type: 'default',
							callback_id: "DASHBOARD_ACTIONS_FOR_USER",
							fallback: 'Would you like to do something?',
							mrkdwn_in: ["text", "fields"],
							color: _constants.colorsHash.toki_yellow.hex,
							text: "_Set your status:_",
							actions: [{
								name: "SET_PRIORITY",
								text: "Let's do it!",
								value: '{"setPriority": true}',
								type: "button"
							}]
						});

						bot.api.channels.history({
							token: accessToken,
							channel: ChannelId
						}, function (err, response) {

							if (!err) {
								(function () {
									var messages = response.messages;

									var teamPulseDashboardMessage = false;
									var messageCount = 0;

									// iterate through messages to find
									// the `DASHBOARD_TEAM_PULSE` attachment
									_lodash2.default.some(messages, function (message) {

										// user is `SlackUserId`
										var user = message.user;
										var attachments = message.attachments;

										// find the message of the team pulse

										if (user == BotSlackUserId && attachments && attachments[0].callback_id == _constants.constants.dashboardCallBackId) {
											teamPulseDashboardMessage = message;
											return true;
										}

										messageCount++;
									});

									if (teamPulseDashboardMessage) {
										(function () {

											// update the attachments with the session info!
											var _teamPulseDashboardMe = teamPulseDashboardMessage;
											var ts = _teamPulseDashboardMe.ts;

											var updateTeamPulseDashboardMessageObject = {
												channel: ChannelId,
												ts: ts,
												attachments: attachments
											};

											updateTeamPulseDashboardMessageObject.text = text;
											updateTeamPulseDashboardMessageObject.attachments = JSON.stringify(attachments);
											bot.api.chat.update(updateTeamPulseDashboardMessageObject);

											if (messageCount > 15) {

												// if it's been over 15 messages since
												// team_pulse dashboard, then we should reset it
												// (i.e. delete => create new one)

												bot.send({
													channel: ChannelId,
													text: 'Hey, looks like the dashboard has been pushed up by some messages, so here it is again!'
												}, function () {
													bot.api.chat.delete(updateTeamPulseDashboardMessageObject);
													bot.send({
														channel: ChannelId,
														text: text,
														attachments: attachments
													});
												});
											}
										})();
									} else {
										// channel does not have pulse dashboard, let's insert one...
										console.log('\n\n\n no pulse dashboard... creating new one:');
										bot.send({
											channel: ChannelId,
											text: text,
											attachments: attachments
										});
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
} /**
   * 			THINGS THAT HELP WITH JS OBJECTS <> MESSAGES
   */

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