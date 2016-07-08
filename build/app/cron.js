'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function () {

	// check for reminders and sessions every minute!

	if (_controllers.bots) {
		checkForReminders();
		checkForSessions();
	}
};

var _controllers = require('../bot/controllers');

var _constants = require('./lib/constants');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var checkForSessions = function checkForSessions() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = _moment2.default.tz("America/New_York").format("YYYY-MM-DD HH:mm:ss Z");

	_models2.default.WorkSession.findAll({
		where: ['"endTime" < ? AND open = ?', now, true],
		order: '"WorkSession"."createdAt" DESC',
		include: [_models2.default.DailyTask]
	}).then(function (workSessions) {

		// these are the work sessions that have ended within last 5 minutes
		// and have not closed yet

		var workSessionsArray = [];

		workSessions.forEach(function (workSession) {
			var UserId = workSession.UserId;
			var open = workSession.open;

			/**
    * 		For each work session
    * 			1. close it
    * 			2. find user and start end_work_session flow
    */

			workSession.update({
				open: false
			}).then(function (workSession) {
				_models2.default.User.find({
					where: { id: UserId },
					include: [_models2.default.SlackUser]
				}).then(function (user) {
					var SlackUserId = user.SlackUser.SlackUserId;

					var config = {
						SlackUserId: SlackUserId,
						workSession: workSession
					};

					// we need to find the bot that contains this user
					// 1. find team of slack user
					// 2. get token of that team
					// 3. get that bot by token

					var TeamId = user.SlackUser.TeamId;


					_models2.default.Team.find({
						where: { TeamId: TeamId }
					}).then(function (team) {
						var token = team.token;

						var bot = _controllers.bots[token];
						if (bot) {
							// alarm is up for session
							_controllers.controller.trigger('session_timer_up', [bot, config]);
						}
					});
				});
			});
		});
	});
};

// the cron file!


// sequelize models


var checkForReminders = function checkForReminders() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = _moment2.default.tz("America/New_York").format("YYYY-MM-DD HH:mm:ss Z");

	_models2.default.Reminder.findAll({
		where: ['"remindTime" < ? AND open = ?', now, true]
	}).then(function (reminders) {

		// these are all reminders that have passed expiration date
		// yet have not been closed yet
		var remindersArray = [];
		reminders.forEach(function (reminder) {
			var UserId = reminder.UserId;
			var open = reminder.open;

			// for each open reminder:
			// 1. close the reminder
			// 2. find the user of the reminder
			// 3. send the reminder

			reminder.update({
				open: false
			}).then(function () {
				return _models2.default.User.find({
					where: { id: UserId },
					include: [_models2.default.SlackUser]
				});
			}).then(function (user) {
				var _user$SlackUser = user.SlackUser;
				var TeamId = _user$SlackUser.TeamId;
				var SlackUserId = _user$SlackUser.SlackUserId;


				_models2.default.Team.find({
					where: { TeamId: TeamId }
				}).then(function (team) {
					var token = team.token;

					var bot = _controllers.bots[token];

					if (bot) {

						if (reminder.type == _constants.constants.reminders.doneSessionSnooze) {

							user.getWorkSessions({
								order: '"WorkSession"."createdAt" DESC',
								limit: 1,
								include: [_models2.default.DailyTask]
							}).then(function (workSessions) {
								// get most recent work session for snooze option
								if (workSessions.length > 0) {
									var config = {
										workSession: workSessions[0],
										SlackUserId: SlackUserId
									};
									_controllers.controller.trigger('session_timer_up', [bot, config]);
								}
							});
						} else {
							// alarm is up for reminder
							// send the message!
							bot.startPrivateConversation({
								user: user.SlackUser.SlackUserId
							}, function (err, convo) {

								if (convo) {
									var customNote = reminder.customNote ? '(`' + reminder.customNote + '`)' : '';
									var message = 'Hey! You wanted a reminder ' + customNote + ' :smiley: :alarm_clock: ';

									convo.say(message);
								}
							});
						}
					}
				});
			});
		});
	});
};
//# sourceMappingURL=cron.js.map