'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// get reminder
	// if user did not specify reminder, then go through conversational flow about it
	controller.hears(['custom_reminder'], 'direct_message', _index.wit.hears, function (bot, message) {

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			// these are array of objects
			var text = message.text;
			var _message$intentObject = message.intentObject.entities;
			var reminder = _message$intentObject.reminder;
			var datetime = _message$intentObject.datetime;
			var duration = _message$intentObject.duration;

			var SlackUserId = message.user;

			// if command starts with "add", then we must assume they are adding a task
			if (_botResponses.utterances.startsWithAdd.test(text)) {
				/**
     * 		TRIGGERING ADD TASK FLOW (add_task_flow)
     */
				var intent = _intents2.default.ADD_TASK;

				var userMessage = {
					text: text,
					reminder: reminder,
					duration: duration
				};

				// if the user says tasks (plural), then assume
				// they want to add multiple tasks
				var tasksRegExp = new RegExp(/(\btasks\b)/i);
				if (tasksRegExp.test(text)) {
					intent = _intents2.default.EDIT_TASKS;
				}

				var config = {
					intent: intent,
					SlackUserId: SlackUserId,
					message: userMessage
				};

				controller.trigger('new_session_group_decision', [bot, config]);

				return;
			}

			var config = {
				text: text,
				reminder: reminder,
				datetime: datetime,
				duration: duration,
				SlackUserId: SlackUserId
			};

			// handle for snooze!
			var response = message.text;
			if (_botResponses.utterances.containsSnooze.test(response)) {

				if (_botResponses.utterances.onlyContainsSnooze.test(response)) {
					// automatically do default snooze here then
					controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId }]);
				} else {
					// ask how long to snooze for
					controller.trigger('snooze_reminder_flow', [bot, config]);
				}

				return;
			}

			// if they want a reminder, just tell them how to structure it
			if (!datetime && !duration) {
				console.log("about to ask for reminder...");
				console.log(config);
				controller.trigger('ask_for_reminder', [bot, config]);
				return;
			} else {
				// user has already specified time
				controller.trigger('set_reminder', [bot, config]);
			}
		}, 850);
	});

	// asking for snooze flow
	// snooze currently does not handle `datetime`, ONLY `duration`
	controller.on('snooze_reminder_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var duration = config.duration;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// get timezone of user
			var tz = user.SlackUser.tz;


			if (duration) {
				var remindTimeStampObject = (0, _miscHelpers.witDurationToTimeZoneObject)(duration, tz);
				controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId, remindTimeStampObject: remindTimeStampObject }]);
			} else {
				// need to ask for duration if it doesn't exist
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					convo.snoozeConfig = {
						SlackUserId: SlackUserId,
						tz: tz
					};

					convo.ask("How long would you like to snooze?", function (response, convo) {

						var time = response.text;
						var minutes = false;

						var validMinutesTester = new RegExp(/[\dh]/);
						if (validMinutesTester.test(time)) {
							minutes = (0, _messageHelpers.convertTimeStringToMinutes)(time);
						}

						if (minutes) {
							convo.snoozeConfig.minutes = minutes;
						} else {
							convo.say("Sorry, still learning :dog:. Let me know how long you want to snooze for `i.e. 10 min`");
							convo.repeat();
						}
						convo.next();
					});
					convo.on('end', function (convo) {
						var _convo$snoozeConfig = convo.snoozeConfig;
						var tz = _convo$snoozeConfig.tz;
						var minutes = _convo$snoozeConfig.minutes;

						// create moment object out of info

						if (minutes) {
							var now = (0, _momentTimezone2.default)().tz(tz);
							var remindTimeStampObject = now.add(minutes, 'minutes');

							controller.trigger('done_session_snooze_button_flow', [bot, { SlackUserId: SlackUserId, remindTimeStampObject: remindTimeStampObject }]);
						} else {
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						}
					});
				});
			}
		});
	});

	// this is conversational flow to get reminder set
	controller.on('ask_for_reminder', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		if (!SlackUserId) {
			console.log("NOT WORKING IN ask_for_reminder...");
			console.log(config);
			console.log("\n\n\n\n\n");
			return;
		}

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// get timezone of user
			var tz = user.SlackUser.tz;


			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				convo.reminderConfig = {
					SlackUserId: SlackUserId,
					tz: tz
				};

				convo.ask("What time would you like me to check in with you? :bellhop_bell:", function (response, convo) {
					var text = response.text;
					var entities = response.intentObject.entities;
					var reminder = entities.reminder;
					var duration = entities.duration;
					var datetime = entities.datetime;


					if (!duration && !datetime) {
						convo.say("Sorry, still learning :dog:. Please let me know the time that you want a reminder `i.e. at 4:51pm`");
						convo.repeat();
					} else {

						convo.reminderConfig.text = text;
						convo.reminderConfig.duration = duration;
						convo.reminderConfig.datetime = datetime;

						convo.say("Excellent! Would you like me to remind you about anything when I check in?");
						convo.ask("You can leave any kind of one-line note, like `call Kevin` or `follow up with Taylor about design feedback`", [{
							pattern: _botResponses.utterances.yes,
							callback: function callback(response, convo) {
								convo.ask('What note would you like me to remind you about?', function (response, convo) {
									convo.reminderConfig.reminder = [{ value: response.text }];
									convo.next();
								});
								convo.next();
							}
						}, {
							pattern: _botResponses.utterances.no,
							callback: function callback(response, convo) {
								convo.next();
							}
						}, {
							default: true,
							callback: function callback(response, convo) {
								convo.reminderConfig.reminder = [{ value: response.text }];
								convo.next();
							}
						}]);
					}

					convo.next();
				});
				convo.on('end', function (convo) {
					var config = convo.reminderConfig;
					console.log("CONFIG ON FINISH:");
					console.log(config);
					console.log("\n\n\n\n\n");
					controller.trigger('set_reminder', [bot, config]);
				});
			});
		});
	});

	// the actual setting of reminder
	controller.on('set_reminder', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var reminder = config.reminder;
		var datetime = config.datetime;
		var duration = config.duration;
		var text = config.text;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// get timezone of user
			var tz = user.SlackUser.tz;

			var UserId = user.id;

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				convo.reminderObject = {
					SlackUserId: SlackUserId,
					UserId: UserId,
					tz: tz
				};

				var now = (0, _momentTimezone2.default)();

				// get note for reminder
				var customNote = null;
				if (reminder) {
					customNote = reminder[0].value;
				}
				convo.reminderObject.customNote = customNote;

				// this is passed in response objects, need to format it
				var responseObject = {
					text: text,
					intentObject: {
						entities: {
							duration: duration,
							datetime: datetime
						}
					}
				};
				var remindTimeStamp = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(responseObject, tz);

				// if we have the time for reminder, we're good to go!
				if (remindTimeStamp) {

					convo.reminderObject.remindTimeStamp = remindTimeStamp;
					var remindTimeStampString = remindTimeStamp.format('h:mm a');

					convo.say('Okay, :alarm_clock: set. See you at ' + remindTimeStampString + '!');
					convo.next();
				} else {
					// need to ask user about it
					askUserForReminder(err, convo);
				}

				convo.on('end', function (convo) {
					var _convo$reminderObject = convo.reminderObject;
					var UserId = _convo$reminderObject.UserId;
					var SlackUserId = _convo$reminderObject.SlackUserId;
					var remindTimeStamp = _convo$reminderObject.remindTimeStamp;
					var customNote = _convo$reminderObject.customNote;

					if (remindTimeStamp) {
						_models2.default.Reminder.create({
							remindTime: remindTimeStamp,
							UserId: UserId,
							customNote: customNote
						});
					}

					(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
				});
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _miscHelpers = require('../../lib/miscHelpers');

var _messageHelpers = require('../../lib/messageHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// user did not accurately ask for a reminder and we need to clarify
function askUserForReminder(response, convo) {
	var tz = convo.reminderObject.tz;

	var now = (0, _momentTimezone2.default)();

	convo.ask("Sorry, still learning :dog:. Please let me know the time that you want a reminder `i.e. at 4:51pm`", function (response, convo) {

		var remindTimeStamp = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);

		if (remindTimeStamp) {
			convo.reminderObject.remindTimeStamp = remindTimeStamp;
			var remindTimeStampString = remindTimeStamp.format('h:mm a');
			convo.say('Okay, :alarm_clock: set. See you at ' + remindTimeStampString + '!');
		} else {
			convo.say("Ah I'm sorry. Still not getting you :thinking_face:");
			convo.repeat();
		}

		convo.next();
	});
}

// base controller for reminders
//# sourceMappingURL=index.js.map