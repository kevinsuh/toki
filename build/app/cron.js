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

var _startWorkSessionFunctions = require('../bot/controllers/modules/startWorkSessionFunctions');

var _constants = require('./lib/constants');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var checkForSessions = function checkForSessions() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = (0, _moment2.default)().format("YYYY-MM-DD HH:mm:ss Z");

	// get the most recent work session! assume this is the one user is working on
	_models2.default.WorkSession.findAll({
		where: ['"endTime" < ? AND "live" = ? AND "open" = ?', now, true, true],
		order: '"WorkSession"."createdAt" DESC',
		include: [_models2.default.DailyTask]
	}).then(function (workSessions) {

		var workSessionsArray = [];

		workSessions.forEach(function (workSession) {
			var UserId = workSession.UserId;
			var open = workSession.open;
			var live = workSession.live;

			// 1. check if user is in conversation
			// 2. if not, update live to false and ping
			// ~~ live should only be turned off, if it pings in response ~~

			/**
    * 		For each work session
    * 			1. close it
    * 			2. find user and start end_work_session flow
    */

			workSession.update({
				live: false
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
	var now = (0, _moment2.default)().format("YYYY-MM-DD HH:mm:ss Z");

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
				var tz = _user$SlackUser.tz;
				var TeamId = _user$SlackUser.TeamId;
				var SlackUserId = _user$SlackUser.SlackUserId;


				_models2.default.Team.find({
					where: { TeamId: TeamId }
				}).then(function (team) {
					var token = team.token;

					var bot = _controllers.bots[token];

					if (bot) {

						if (reminder.type == _constants.constants.reminders.doneSessionSnooze) {

							var _UserId = user.id;
							user.getWorkSessions({
								where: ['"WorkSession"."UserId" = ?', _UserId],
								order: '"WorkSession"."createdAt" DESC',
								limit: 1
							}).then(function (workSessions) {
								// get most recent work session for snooze option
								if (workSessions.length > 0) {
									var workSession = workSessions[0];
									workSession.getDailyTasks({}).then(function (dailyTasks) {
										workSession.DailyTasks = dailyTasks;
										var config = {
											workSession: workSession,
											SlackUserId: SlackUserId
										};
										_controllers.controller.trigger('session_timer_up', [bot, config]);
									});
								}
							});
						} else {
							// alarm is up for reminder
							// send the message!
							bot.startPrivateConversation({
								user: user.SlackUser.SlackUserId
							}, function (err, convo) {

								if (convo) {

									if (reminder.type == "start_work") {
										// this type of reminder will immediately ask user if they want to get started
										reminder.getDailyTask({
											include: [_models2.default.Task]
										}).then(function (dailyTask) {

											convo.sessionStart = {
												SlackUserId: SlackUserId,
												tz: tz
											};

											if (dailyTask) {
												convo.sessionStart.dailyTask = dailyTask;
												(0, _startWorkSessionFunctions.finalizeTimeAndTasksToStart)(convo);
											} else {
												convo.say('Hey! Let\'s get started on that work session :smiley:');
												convo.next();
											}
										});
									} else {
										// standard reminder
										var customNote = reminder.customNote ? '(`' + reminder.customNote + '`)' : '';
										var message = 'Hey! You wanted a reminder ' + customNote + ':alarm_clock: ';
										convo.say(message);
									}

									convo.on('end', function (convo) {

										console.log("\n\n\n end of start session ");
										console.log(convo.sessionStart);
										console.log("\n\n\n");
									});
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