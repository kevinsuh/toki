'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  * HANDLE DASHBOARD HERE
  */

	// joined a channel => make sure they want dashboard functionality
	controller.on(['channel_joined', 'group_joined'], function (bot, message) {

		var BotSlackUserId = bot.identity.id;

		console.log('\n\n\n yo joined the channel or group. (bot id is ' + BotSlackUserId + '):');
		console.log(message);

		var type = message.type;
		var _message$channel = message.channel;
		var id = _message$channel.id;
		var creator = _message$channel.creator;
		var members = _message$channel.members;
		var name = _message$channel.name;


		var botToken = bot.config.token;
		bot = _index.bots[botToken];

		// create channel record
		_models2.default.Channel.findOrCreate({
			where: { ChannelId: id }
		}).spread(function (channel, created) {
			var ChannelId = channel.ChannelId;
			var tz = channel.tz;


			var config = {
				ChannelId: ChannelId,
				BotSlackUserId: BotSlackUserId
			};

			_models2.default.User.find({
				where: { SlackUserId: creator }
			}).then(function (user) {

				var promise = [];
				if (user && user.TeamId) {
					promise.push(channel.update({
						TeamId: user.TeamId
					}));
				}

				Promise.all(promise).then(function () {

					// delete all teamPulseMessages for now and then create new one
					// when inviting for the first time
					_models2.default.Channel.find({
						where: { ChannelId: ChannelId }
					}).then(function (channel) {
						var ChannelId = channel.ChannelId;
						var tz = channel.tz;
						var TeamId = channel.TeamId;


						_models2.default.Team.find({
							where: ['"Team"."TeamId" = ?', TeamId]
						}).then(function (team) {
							var accessToken = team.accessToken;

							if (!accessToken) {
								console.log('\n\n\n ERROR... NO ACCESS TOKEN FOR BOT: ' + accessToken);
								return;
							}

							bot.api.channels.history({
								token: accessToken,
								channel: ChannelId
							}, function (err, response) {
								var messages = response.messages;

								messages.forEach(function (message) {

									// user is `SlackUserId`
									var user = message.user;
									var attachments = message.attachments;
									var ts = message.ts;

									// find the message of the team pulse

									if (user == BotSlackUserId && attachments && attachments[0].callback_id == _constants.constants.dashboardCallBackId) {
										bot.api.chat.delete({
											ts: ts,
											channel: ChannelId
										});
									}
								});

								if (tz) {
									// give a little time for all things to delete
									setTimeout(function () {
										controller.trigger('setup_dashboard_flow', [bot, config]);
									}, 500);
								} else {
									var timezoneConfig = {
										CreatorSlackUserId: creator,
										ChannelId: ChannelId
									};
									controller.trigger('get_timezone_for_dashboard_flow', [bot, timezoneConfig]);
								}
							});
						});
					});
				});
			});
		});
	});

	// this is set up for dashboard flow when tz does not exist
	controller.on('get_timezone_for_dashboard_flow', function (bot, config) {
		var CreatorSlackUserId = config.CreatorSlackUserId;
		var ChannelId = config.ChannelId;


		bot.startPrivateConversation({ user: CreatorSlackUserId }, function (err, convo) {

			convo.dashboardConfirm = {
				ChannelId: ChannelId
			};

			// right now we cannot handle confirmation of dashboard because
			// we don't have channels:write permission		
			askTimeZoneForChannelDashboard(convo);

			// now trigger dashboard intro
			convo.on('end', function (convo) {

				// only way to get here is if timezone got updated.
				// now we can handle dashboard flow
				var _convo$dashboardConfi = convo.dashboardConfirm;
				var ChannelId = _convo$dashboardConfi.ChannelId;
				var neverMind = _convo$dashboardConfi.neverMind;


				if (neverMind) {
					return;
				}

				controller.trigger('setup_dashboard_flow', [bot, config]);
			});
		});
	});

	controller.on('setup_dashboard_flow', function (bot, config) {
		var ChannelId = config.ChannelId;
		var BotSlackUserId = config.BotSlackUserId;
		var tz = config.tz;

		// introduction message

		bot.send({
			channel: ChannelId,
			text: 'Hi! I\'m Toki, your team\'s sidekick to make the most of your attention each day :raised_hands:\nI\'ll set up a dashboard here of your team\'s statuses each day. If you ever need a refresher on how I work, just say `/explain` and I\'d love to go into more detail!'
		}, function () {

			(0, _slackHelpers.updateDashboardForChannelId)(bot, ChannelId);
		});
	});
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _sessions = require('../sessions');

var _slackHelpers = require('../../lib/slackHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function askTimeZoneForChannelDashboard(convo) {
	var text = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	var ChannelId = convo.dashboardConfirm.ChannelId;


	if (text == '') {
		text = 'Thanks for inviting me to <#' + ChannelId + '>! I\'ll introduce myself and set up a dashboard there of your team\'s priorities once I get which timezone you want <#' + ChannelId + '> to operate in :raised_hands:';
	}

	convo.ask({
		text: text,
		attachments: _constants.timeZoneAttachments
	}, [{ // completedPriority
		pattern: _constants.utterances.noAndNeverMind,
		callback: function callback(response, convo) {
			convo.dashboardConfirm.neverMind = true;
			convo.say('Okay! If you want me to set up a dashboard in <#' + ChannelId + '> in the future, please `/remove` me then `/invite` me in <#' + ChannelId + '> again :wave:');
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
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
				askTimeZoneForChannelDashboard(convo, 'Which timezone do you want the channel in?');
				convo.next();
			} else if (timeZoneObject == _constants.timeZones.other) {
				convo.say('Sorry!');
				convo.say("Right now I’m only able to work in these timezones. If you want to demo Toki, just pick one of these timezones for now. I’ll try to get your timezone included as soon as possible!");
				askTimeZoneForChannelDashboard(convo, 'Which timezone do you want to go with for now?');
				convo.next();
			} else {
				// success!!

				var _timeZoneObject = timeZoneObject;
				var tz = _timeZoneObject.tz;

				console.log(timeZoneObject);
				_models2.default.Channel.update({
					tz: tz
				}, {
					where: { ChannelId: ChannelId }
				}).then(function (user) {
					convo.say('Great! If your timezone for <#' + ChannelId + '> changes, you can always `update settings`');
					convo.next();
				});
			}
		}
	}]);
}
//# sourceMappingURL=index.js.map