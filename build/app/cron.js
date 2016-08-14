'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function () {

	// check for reminders and sessions every minute!

	if (_controllers.bots) {
		checkForReminders();
		checkForSessions();
		checkForMorningPing();
	}
};

var _controllers = require('../bot/controllers');

var _constants = require('./lib/constants');

var _constants2 = require('../bot/lib/constants');

var _miscHelpers = require('../bot/lib/miscHelpers');

var _messageHelpers = require('../bot/lib/messageHelpers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var checkForMorningPing = function checkForMorningPing() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss Z");

	_models2.default.User.findAll({
		where: ['"pingTime" < ? AND "wantsPing" = ?', now, true],
		include: [_models2.default.SlackUser]
	}).then(function (users) {

		users.forEach(function (user) {
			var UserId = user.id;
			var pingTime = user.pingTime;
			var _user$SlackUser = user.SlackUser;
			var SlackUserId = _user$SlackUser.SlackUserId;
			var tz = _user$SlackUser.tz;
			var TeamId = _user$SlackUser.TeamId;


			var day = (0, _momentTimezone2.default)().tz(tz).format('dddd');
			if (day == "Saturday" || day == "Sunday") {
				// don't trigger on weekends for now!
				var nextDay = (0, _momentTimezone2.default)(pingTime).add(1, 'days');
				_models2.default.User.update({
					pingTime: nextDay
				}, {
					where: ['"id" = ?', UserId]
				});
			} else {
				// ping, then update to the next day
				_models2.default.Team.find({
					where: { TeamId: TeamId }
				}).then(function (team) {
					var token = team.token;

					var bot = _controllers.bots[token];
					if (bot) {
						// delete most recent ping!
						deleteMostRecentMorningPing(bot, SlackUserId);
						setTimeout(function () {
							_controllers.controller.trigger('user_morning_ping', [bot, { SlackUserId: SlackUserId }]);
						}, 1500);
						var _nextDay = (0, _momentTimezone2.default)(pingTime).add(1, 'days');
						_models2.default.User.update({
							pingTime: _nextDay
						}, {
							where: ['"id" = ?', UserId]
						});
					}
				});
			}
		});
	});
};

// this deletes the most recent message, if it was a morning_ping message
// this is to ensure that user does not get multitude of morning_ping messages stacked up, if they have not responded to one


// the cron file!


// sequelize models
function deleteMostRecentMorningPing(bot, SlackUserId) {

	bot.api.im.open({ user: SlackUserId }, function (err, response) {

		if (response.channel && response.channel.id) {
			(function () {
				var channel = response.channel.id;
				bot.api.im.history({ channel: channel }, function (err, response) {

					if (response && response.messages && response.messages.length > 0) {

						var mostRecentMessage = response.messages[0];

						var ts = mostRecentMessage.ts;
						var attachments = mostRecentMessage.attachments;

						if (attachments && attachments.length > 0 && attachments[0].callback_id == 'MORNING_PING_START_DAY' && ts) {

							console.log("\n\n ~~ deleted ping day message! ~~ \n\n");
							// if the most recent message was a morning ping day, then we will delete it!
							var messageObject = {
								channel: channel,
								ts: ts
							};
							bot.api.chat.delete(messageObject);
						}
					}
				});
			})();
		}
	});
}

var checkForSessions = function checkForSessions() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss Z");

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
							var sessionTimerUp = true;
							config.sessionTimerUp = sessionTimerUp;
							_controllers.controller.trigger('done_session_flow', [bot, { SlackUserId: SlackUserId, sessionTimerUp: sessionTimerUp }]);
						}
					});
				});
			});
		});
	});
};

var checkForReminders = function checkForReminders() {

	// sequelize is in EST by default. include date offset to make it correct UTC wise
	var now = (0, _momentTimezone2.default)().format("YYYY-MM-DD HH:mm:ss Z");

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
				var _user$SlackUser2 = user.SlackUser;
				var tz = _user$SlackUser2.tz;
				var TeamId = _user$SlackUser2.TeamId;
				var SlackUserId = _user$SlackUser2.SlackUserId;


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
							(function () {

								var SlackUserId = user.SlackUser.SlackUserId;

								if (reminder.type == "start_work") {
									// this type of reminder will immediately ask user if they want to get started
									reminder.getDailyTask({
										include: [_models2.default.Task]
									}).then(function (dailyTask) {

										// get current session
										var config = {
											SlackUserId: SlackUserId
										};

										_controllers.controller.trigger('begin_session', [bot, config]);
									});
								} else if (reminder.type == "break") {
									(function () {

										var now = (0, _momentTimezone2.default)();
										var reminderStartTime = (0, _momentTimezone2.default)(reminder.createdAt);
										var durationBreak = Math.round(_momentTimezone2.default.duration(now.diff(reminderStartTime)).asMinutes());

										var text = 'Hey, it\'s been ' + durationBreak + ' minutes. Let me know when you\'re ready to get focused again!';

										var attachments = [{
											attachment_type: 'default',
											callback_id: "LETS_START_A_SESSION",
											fallback: "Ready to start another session?",
											color: _constants2.colorsHash.green.hex,
											actions: [{
												name: _constants2.buttonValues.letsDoIt.name,
												text: "Let's do it!",
												value: _constants2.buttonValues.letsDoIt.value,
												type: "button"
											}]
										}];

										bot.startPrivateConversation({
											user: SlackUserId
										}, function (err, convo) {
											// break is up reminder
											convo.say({
												text: text,
												attachments: attachments
											});
										});
									})();
								} else {

									bot.startPrivateConversation({
										user: SlackUserId
									}, function (err, convo) {
										// standard reminder
										var customNote = reminder.customNote ? '(`' + reminder.customNote + '`)' : '';
										var message = 'Hey! You wanted a reminder ' + customNote + ':alarm_clock: ';
										convo.say(message);
									});
								}
							})();
						}
					}
				});
			});
		});
	});
};
//# sourceMappingURL=cron.js.map