'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function () {

	// check for reminders and sessions every minute!
	checkForReminders();
	checkForSessions();
};

var _server = require('../server');

var _controllers = require('../bot/controllers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var checkForSessions = function checkForSessions() {

	// var now = moment();
	// var fiveMinutesAgo = now.subtract(5, "minutes").format("YYYY-MM-DD HH:mm:ss");

	_models2.default.WorkSession.findAll({
		where: ['"endTime" < ? AND open = ?', new Date(), true]
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
			}).then(function () {
				return _models2.default.User.find({
					where: { id: UserId },
					include: [_models2.default.SlackUser]
				});
			}).then(function (user) {
				var SlackUserId = user.SlackUser.SlackUserId;

				var config = {
					SlackUserId: SlackUserId
				};

				// alarm is up for session
				_controllers.controller.trigger('session_timer_up', [_server.bot, config]);
			});
		});
	});
};

// the cron file!


// sequelize models


var checkForReminders = function checkForReminders() {
	// this is for testing
	// var oneMinute = moment().add(5,'minutes').format("YYYY-MM-DD HH:mm:ss");

	_models2.default.Reminder.findAll({
		where: ['"remindTime" < ? AND open = ?', new Date(), true]
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

				// send the message!
				_server.bot.startPrivateConversation({
					user: user.SlackUser.SlackUserId
				}, function (err, convo) {

					if (convo) {
						var customNote = reminder.customNote ? '(`' + reminder.customNote + '`)' : '';
						var message = 'Hey! You wanted a reminder ' + customNote + ' :smiley: :alarm_clock: ';

						convo.say(message);
					}
				});
			});
		});
	});
};
//# sourceMappingURL=cron.js.map