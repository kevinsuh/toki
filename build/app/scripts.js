'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.test = test;
exports.seedAndUpdateUsers = seedAndUpdateUsers;

var _controllers = require('../bot/controllers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _constants = require('../bot/lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		For fun one-off thingz
 */

function test(bot) {

	// U1NCGAETZ slackid of @test
	// U121ZK15J slackid of @kevin
	var SlackUserIds = 'U1NCGAETZ,U121ZK15J';
	bot.api.mpim.open({
		users: SlackUserIds
	}, function (err, response) {
		console.log(response);
		if (!err) {
			var id = response.group.id;

			bot.api.mpim.history({
				channel: id
			}, function (err, response) {

				if (!err) {
					var messages = response.messages;

					console.log('\n\n\n displaying the ' + messages.length + ' messages for this convo');
					console.log(messages[0]);
					var timeStampObject = _momentTimezone2.default.unix(messages[0].ts);
					console.log('\n\n\n timestamp: ' + timeStampObject.format());

					if (messages[0].reactions) {
						console.log(messages[0].reactions);
					}
				}
			});
		}
	});

	// on session_start or session_end...
	// go through all the channels where this BOT is in the channel
	// then find the channels where the user who ended session is ALSO in the channel
	// if both are true, update that message with the user's updated status!

	bot.api.channels.list({}, function (err, response) {

		var BotSlackUserId = bot.identity.id;

		if (!err) {
			var channels = response.channels;


			console.log('\n\n\n there are ' + channels.length + ' channels');

			channels.forEach(function (channel) {
				var id = channel.id;
				var name = channel.name;
				var is_channel = channel.is_channel;
				var topic = channel.topic;
				var purpose = channel.purpose;
				var members = channel.members;


				var hasBotSlackUserId = false;
				var hasMemberSlackUserId = false;

				var KevinSlackUserId = 'U121ZK15J';
				var KevinTeamId = 'T121VLM63';

				_lodash2.default.some(members, function (member) {
					if (member == KevinSlackUserId) {
						hasBotSlackUserId = true;
					} else if (member == BotSlackUserId) {
						hasMemberSlackUserId = true;
					}
				});

				if (hasBotSlackUserId && hasMemberSlackUserId) {

					console.log('\n\n\n channel name: ' + name + ' has both members in slack user');
					console.log(channel);

					_models2.default.Channel.find({
						where: { ChannelId: id }
					}).then(function (channel) {
						var ChannelId = channel.ChannelId;
						var tz = channel.tz;


						if (!tz) {
							console.log('\n\n\n ERROR... NO TZ FOR CHANNEL: ' + ChannelId);
							return;
						}

						var zoneAbbrString = (0, _momentTimezone2.default)().tz(tz).zoneAbbr(); // ex. EDT
						var todayString = (0, _momentTimezone2.default)().tz(tz).format('MMMM Do YYYY'); // ex. September 6th, 2016
						var text = ':raised_hands: *Team Pulse for ' + todayString + '* :raised_hands:';
						var attachments = [];

						_models2.default.Team.find({
							where: ['"Team"."TeamId" = ?', KevinTeamId]
						}).then(function (team) {
							var accessToken = team.accessToken;


							if (!accessToken) {
								console.log('\n\n\n ERROR... NO TZ FOR BOT: ' + ChannelId);
								return;
							}

							var dashboardMemberSlackUserIds = [];
							members.forEach(function (MemberSlackUserId) {

								if (MemberSlackUserId != BotSlackUserId) {
									dashboardMemberSlackUserIds.push(MemberSlackUserId);
								}
							});

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
											title: "Current Priority",
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
										// value is the object that has value.user and value.session
										dashboardUsersArrayAlphabetical.push(value);
									});

									dashboardUsersArrayAlphabetical.sort(function (a, b) {

										var nameA = a.user.dataValues.SlackName;
										var nameB = b.user.dataValues.SlackName;
										return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
									});

									dashboardUsersArrayAlphabetical.forEach(function (dashboardUser) {

										console.log(dashboardUser);

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
											sessionContent = '_No active priority_';
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
										fallback: 'Would you like to set a priority?',
										mrkdwn_in: ["text", "fields"],
										color: _constants.colorsHash.toki_yellow.hex,
										text: "_Update your current priority_",
										actions: [{
											name: "SET_PRIORITY",
											text: "Set My Priority",
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

												console.log('\n\n\n\n message count: ' + messageCount);

												if (teamPulseDashboardMessage) {
													(function () {

														console.log('\n\n\n this is the teamPulseDashboardMessage:');
														console.log(teamPulseDashboardMessage);

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
																text: 'Hey, it\'s been ' + messageCount + ' since the dashboard so I refreshed it'
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
				}
			});
		} else {
			console.log('\n\n\n ~~ error in listing channel:');
			console.log(err);
		}
	});

	bot.api.groups.create({
		name: 'kevin-dashboard'
	}, function (err, response) {

		console.log('\n\n\n group created:');
		console.log(response);
	});
}

function seedAndUpdateUsers(members) {

	members.forEach(function (member) {
		var id = member.id;
		var team_id = member.team_id;
		var name = member.name;
		var tz = member.tz;


		var SlackUserId = id;

		_models2.default.User.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (user) {

			if (user) {

				user.update({
					TeamId: team_id,
					SlackName: name
				});
				if (member.profile && member.profile.email) {
					var email = member.profile.email;

					if (email && user.email == '') {
						user.update({
							email: email
						});
					}
				}
			} else {

				console.log("\n\n ~~ new user and creating ~~ \n\n");
				var _email = '';
				if (member.profile && member.profile.email) _email = member.profile.email;
				_models2.default.User.create({
					SlackUserId: SlackUserId,
					email: _email,
					TeamId: team_id,
					SlackName: name
				});
			}
		});
	});
}
//# sourceMappingURL=scripts.js.map