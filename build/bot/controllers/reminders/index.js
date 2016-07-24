'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// get reminder
	// if user did not specify reminder, then go through conversational flow about it
	controller.hears(['custom_reminder'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {

			_models2.default.User.find({
				where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
				include: [_models2.default.SlackUser]
			}).then(function (user) {

				// get timezone of user
				var tz = user.SlackUser.tz;

				var UserId = user.id;

				// these are array of objects
				var text = message.text;
				var _message$intentObject = message.intentObject.entities;
				var reminder = _message$intentObject.reminder;
				var datetime = _message$intentObject.datetime;
				var duration = _message$intentObject.duration;

				var SlackUserId = message.user;

				// if command starts with "add", then we must assume they are adding a task
				if (_botResponses.utterances.startsWithAdd.test(text) && !_botResponses.utterances.containsCheckin.test(text)) {

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

				config.message = message;
				if (_botResponses.utterances.containsOnlyCheckin.test(text)) {
					config.reminder_type = "work_session";
				}

				controller.trigger('ask_for_reminder', [bot, config]);
			});
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

					convo.ask("How long would you like to extend your session?", function (response, convo) {

						var time = response.text;
						var minutes = false;

						var validMinutesTester = new RegExp(/[\dh]/);
						if (validMinutesTester.test(time)) {
							minutes = (0, _messageHelpers.convertTimeStringToMinutes)(time);
						}

						if (minutes) {
							convo.snoozeConfig.minutes = minutes;
						} else {
							convo.say("Sorry, still learning :dog:. Let me know how long you want to extend your session `i.e. 10 min`");
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
	// option to pass in message and skip asking process
	controller.on('ask_for_reminder', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var message = config.message;
		var reminder_type = config.reminder_type;


		var reminderOrCheckInString = reminder_type == "work_session" ? 'check in at' : 'set a reminder for';

		console.log('\n\n config:');
		console.log(config);

		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// get timezone of user
			var tz = user.SlackUser.tz;

			var UserId = user.id;

			var shouldAskForReminder = true;

			if (message) {
				(function () {
					var _message$intentObject2 = message.intentObject.entities;
					var reminder = _message$intentObject2.reminder;
					var duration = _message$intentObject2.duration;
					var datetime = _message$intentObject2.datetime;

					var customNote = reminder ? reminder[0].value : null;
					var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(message, tz);
					var responseMessage = '';

					// shortcut add and do not ask about the checkin
					if (customTimeObject) {
						(function () {

							shouldAskForReminder = false;
							var customTimeString = customTimeObject.format('h:mm a');

							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

								responseMessage = 'Okay, I\'ll ' + reminderOrCheckInString + ' ' + customTimeString;
								if (customNote) {
									responseMessage = responseMessage + ' about `' + customNote + '`';
								}

								responseMessage = responseMessage + '! :muscle:';
								convo.say(responseMessage);
								convo.next();

								convo.on('end', function (convo) {

									// quick adding a reminder requires both text + time!
									_models2.default.Reminder.create({
										remindTime: customTimeObject,
										UserId: UserId,
										customNote: customNote,
										type: reminder_type
									}).then(function (reminder) {
										(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
									});
								});
							});
						})();
					}
				})();
			}

			if (shouldAskForReminder) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					convo.checkIn = {
						SlackUserId: SlackUserId
					};

					convo.ask('What time would you like me to ' + reminderOrCheckInString + '? Leave a note in the same line if you want me to remember it for you `i.e. halfway done by 4pm`', function (response, convo) {
						var _response$intentObjec = response.intentObject.entities;
						var reminder = _response$intentObjec.reminder;
						var duration = _response$intentObjec.duration;
						var datetime = _response$intentObjec.datetime;


						var customNote = reminder ? reminder[0].value : null;
						var customTimeObject = (0, _miscHelpers.witTimeResponseToTimeZoneObject)(response, tz);
						var responseMessage = '';

						if (customTimeObject) {

							convo.checkIn.customTimeObject = customTimeObject;
							convo.checkIn.customNote = customNote;

							var customTimeString = customTimeObject.format('h:mm a');

							responseMessage = 'Okay, I\'ll ' + reminderOrCheckInString + ' ' + customTimeString;
							if (customNote) {
								responseMessage = responseMessage + ' about `' + customNote + '`';
							}

							responseMessage = responseMessage + '! :muscle:';
							convo.say(responseMessage);
						} else {

							if (customNote) {
								responseMessage = 'Sorry, I need a time :thinking_face: (either `' + customNote + ' in 30 minutes` or `' + customNote + ' at 4:30pm`)';
							} else {
								responseMessage = 'Sorry, I need a time :thinking_face: (either `in 30 minutes` or `at 4:30pm`)';
							}
							convo.say(responseMessage);
							convo.repeat();
						}

						convo.next();
					});

					convo.next();

					convo.on('end', function (convo) {
						var _convo$checkIn = convo.checkIn;
						var customTimeObject = _convo$checkIn.customTimeObject;
						var customNote = _convo$checkIn.customNote;

						// quick adding a reminder requires both text + time!

						_models2.default.Reminder.create({
							remindTime: customTimeObject,
							UserId: UserId,
							customNote: customNote,
							type: reminder_type
						}).then(function (reminder) {
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						});
					});
				});
			}
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
//# sourceMappingURL=index.js.map