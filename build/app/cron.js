'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function () {

	if (_controllers.bots) {
		// cron job functions go here
		checkForSessions();
	}
};

var _controllers = require('../bot/controllers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
				live: false,
				open: false
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
								var sessionTimerUp = true;
								config.sessionTimerUp = sessionTimerUp;
								_controllers.controller.trigger('done_session_flow', [bot, { SlackUserId: SlackUserId, sessionTimerUp: sessionTimerUp }]);
							}
						});
					});
				}
			});
		});
	});
};

// the cron file!
//# sourceMappingURL=cron.js.map