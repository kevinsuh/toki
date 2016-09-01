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

// these are all pings that are not sessionEnd
var checkForPings = function checkForPings() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = (0, _momentTimezone2.default)();
	var nowString = now.format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	// turn all work sessions off for that user once you ping that user
	_models2.default.Ping.findAll({
		where: ['"Ping"."live" = ? AND "Ping"."deliveryType" != ?', true, _constants.constants.pingDeliveryTypes.sessionEnd],
		order: '"Ping"."createdAt" ASC',
		include: [{ model: _models2.default.User, as: 'FromUser' }, { model: _models2.default.User, as: 'ToUser' }, _models2.default.PingMessage]
	}).then(function (pings) {

		var groupPings = { fromUser: {} };

		// group pings together by unique FromUser => ToUser combo
		pings.forEach(function (ping) {
			var _ping$dataValues = ping.dataValues;
			var FromUserId = _ping$dataValues.FromUserId;
			var ToUserId = _ping$dataValues.ToUserId;
			var deliveryType = _ping$dataValues.deliveryType;
			var pingTime = _ping$dataValues.pingTime;


			if (groupPings.fromUser[FromUserId]) {

				if (groupPings.fromUser[FromUserId].toUser[ToUserId]) {
					groupPings.fromUser[FromUserId].toUser[ToUserId].push(ping);
				} else {
					groupPings.fromUser[FromUserId].toUser[ToUserId] = [ping];
				}
			} else {

				groupPings.fromUser[FromUserId] = { toUser: {} };
				groupPings.fromUser[FromUserId].toUser[ToUserId] = [ping];
			}
		});

		// send all unique group pings!
		for (var fromUserId in groupPings.fromUser) {

			if (!groupPings.fromUser.hasOwnProperty(fromUserId)) {
				continue;
			}

			var _loop = function _loop(toUserId) {

				if (!groupPings.fromUser[fromUserId].toUser.hasOwnProperty(toUserId)) {
					return 'continue';
				}

				var pings = groupPings.fromUser[fromUserId].toUser[toUserId];
				var pingPromises = [];
				pings.forEach(function (ping) {
					pingPromises.push(_models2.default.Ping.update({
						live: false
					}, {
						where: { id: ping.dataValues.id }
					}));
				});

				if (pings.length > 0) {
					// right now just proxy to first delivery type (they should all be the same)
					var deliveryType = pings[0].dataValues.deliveryType;
					if ((0, _pingFunctions.sendGroupPings)(pings, deliveryType)) {
						Promise.all(pingPromises);
					}
				}
			};

			for (var toUserId in groupPings.fromUser[fromUserId].toUser) {
				var _ret = _loop(toUserId);

				if (_ret === 'continue') continue;
			}
		}
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
							SlackUserId: SlackUserId
						};

						_models2.default.Team.find({
							where: { TeamId: TeamId }
						}).then(function (team) {
							var token = team.token;

							var bot = _controllers.bots[token];
							if (bot) {
								// alarm is up for session
								config.endSessionType = _constants.constants.endSessionTypes.sessionTimerUp;
								_controllers.controller.trigger('end_session_flow', [bot, config]);
							}
						});
					});
				}
			});
		});
	});
};
//# sourceMappingURL=cron.js.map