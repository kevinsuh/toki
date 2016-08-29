'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function () {

	if (_controllers.bots) {
		// cron job functions go here
		checkForSessions();
		checkForPings();
	}
};

var _controllers = require('../bot/controllers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _constants = require('../bot/lib/constants');

var _pingFunctions = require('../bot/controllers/pings/pingFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var checkForPings = function checkForPings() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = (0, _momentTimezone2.default)();
	var nowString = now.format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	// turn all work sessions off for that user once you ping that user
	_models2.default.Ping.findAll({
		where: ['"Ping"."live" = ? AND "Ping"."deliveryType" != ?', true, "sessionEnd"],
		order: '"Ping"."createdAt" DESC'
	}).then(function (pings) {

		pings.forEach(function (ping) {
			var FromUserId = ping.FromUserId;
			var ToUserId = ping.ToUserId;
			var deliveryType = ping.deliveryType;
			var pingTime = ping.pingTime;

			// if there's a pingTime, respect it and dont send yet!

			if (pingTime) {
				var pingTimeObject = (0, _momentTimezone2.default)(pingTime);
				if (pingTimeObject > now) {
					return;
				}
			}

			ping.getPingMessages({}).then(function (pingMessages) {
				_models2.default.User.find({
					where: { id: FromUserId }
				}).then(function (fromUser) {

					var fromUserTeamId = fromUser.TeamId;

					_models2.default.User.find({
						where: { id: ToUserId }
					}).then(function (toUser) {

						var toUserTeamId = toUser.TeamId;

						if (fromUserTeamId != toUserTeamId) {
							// ERROR ERROR -- this should never happen!
							return;
						}

						ping.update({
							live: false
						}).then(function () {

							var fromUserConfig = {
								UserId: fromUser.dataValues.id,
								SlackUserId: fromUser.dataValues.SlackUserId,
								TeamId: fromUser.dataValues.TeamId
							};
							var toUserConfig = {
								UserId: toUser.dataValues.id,
								SlackUserId: toUser.dataValues.SlackUserId,
								TeamId: toUser.dataValues.TeamId
							};
							var config = {
								deliveryType: deliveryType,
								pingMessages: pingMessages
							};

							(0, _pingFunctions.sendPing)(fromUserConfig, toUserConfig, config);
						});
					});
				});
			});
		});
	});
};

// the cron file!


var checkForSessions = function checkForSessions() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	// turn all work sessions off for that user once you ping that user
	_models2.default.Session.findAll({
		where: ['"Session"."endTime" < ? AND "Session"."live" = ? AND "Session"."open" = ?', now, true, true],
		order: '"Session"."createdAt" DESC'
	}).then(function (sessions) {

		var accountedForUserIds = []; // ensure no double-counts

		sessions.forEach(function (session) {
			var UserId = session.UserId;
			var open = session.open;
			var live = session.live;


			session.update({
				live: false
			}).then(function (session) {

				// only trigger session if not accounted for yet
				if (!_lodash2.default.includes(accountedForUserIds, UserId)) {
					accountedForUserIds.push(UserId);
					_models2.default.User.find({
						where: { id: UserId }
					}).then(function (user) {
						var SlackUserId = user.SlackUserId;
						var TeamId = user.TeamId;


						var config = {
							SlackUserId: SlackUserId,
							session: session
						};

						_models2.default.Team.find({
							where: { TeamId: TeamId }
						}).then(function (team) {
							var token = team.token;

							var bot = _controllers.bots[token];
							if (bot) {
								// alarm is up for session
								var endSessionType = 'sessionTimerUp';
								config.endSessionType = endSessionType;
								_controllers.controller.trigger('end_session_flow', [bot, { SlackUserId: SlackUserId, endSessionType: endSessionType }]);
							}
						});
					});
				}
			});
		});
	});
};
//# sourceMappingURL=cron.js.map