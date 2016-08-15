'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	controller.hears(['settings'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;

		var config = { SlackUserId: SlackUserId };

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('settings_flow', [bot, config]);
		}, 550);
	});

	/**
  *      SETTINGS FLOW
  */

	controller.on('settings_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			user.SlackUser.getIncluded({
				include: [_models2.default.User]
			}).then(function (includedSlackUsers) {

				console.log('\n\n included slack users: \n\n');
				console.log(includedSlackUsers);

				var nickName = user.nickName;
				var defaultSnoozeTime = user.defaultSnoozeTime;
				var defaultBreakTime = user.defaultBreakTime;
				var wantsPing = user.wantsPing;
				var pingTime = user.pingTime;
				var includeOthersDecision = user.includeOthersDecision;
				var tz = user.SlackUser.tz;

				var userTimeZone = {};
				for (var key in _constants.timeZones) {
					if (_constants.timeZones[key].tz == tz) {
						userTimeZone = _constants.timeZones[key];
					}
				}

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					// have 2-minute exit time limit
					convo.task.timeLimit = 120000;

					var name = user.nickName || user.email;
					convo.name = name;

					// these are all pulled from the DB, then gets "re-updated" at the end. if nothing changed, then we will just re-update the same existing data
					convo.settings = {
						SlackUserId: SlackUserId,
						timeZone: userTimeZone,
						nickName: name,
						defaultBreakTime: defaultBreakTime,
						defaultSnoozeTime: defaultSnoozeTime,
						wantsPing: wantsPing,
						pingTime: pingTime,
						includeOthersDecision: includeOthersDecision,
						includedSlackUsers: includedSlackUsers
					};

					convo.say('Hello, ' + name + '!');
					(0, _settingsFunctions.settingsHome)(convo);
					convo.next();

					convo.on('end', function (convo) {

						(0, _miscHelpers.consoleLog)("end of settings for user!!!!", convo.settings);

						var _convo$settings = convo.settings;
						var SlackUserId = _convo$settings.SlackUserId;
						var nickName = _convo$settings.nickName;
						var timeZone = _convo$settings.timeZone;
						var defaultBreakTime = _convo$settings.defaultBreakTime;
						var defaultSnoozeTime = _convo$settings.defaultSnoozeTime;
						var wantsPing = _convo$settings.wantsPing;
						var pingTime = _convo$settings.pingTime;
						var includeOthersDecision = _convo$settings.includeOthersDecision;
						var includedSlackUsers = _convo$settings.includedSlackUsers;


						if (timeZone) {
							var _tz = timeZone.tz;

							user.SlackUser.update({
								tz: _tz
							});
						}

						if (nickName) {
							user.update({
								nickName: nickName
							});
						}

						user.update({
							wantsPing: wantsPing
						});

						if (pingTime) {
							user.update({
								pingTime: pingTime
							});
						}

						if (defaultSnoozeTime) {
							user.update({
								defaultSnoozeTime: defaultSnoozeTime
							});
						}

						if (defaultBreakTime) {
							user.update({
								defaultBreakTime: defaultBreakTime
							});
						}

						(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
					});
				});
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _settingsFunctions = require('./settingsFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map