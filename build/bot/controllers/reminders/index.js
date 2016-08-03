'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// right now, you can only get a reminder through trigger!
	controller.on('ask_for_reminder', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var message = config.message;
		var reminder_type = config.reminder_type;


		var reminderOrCheckInString = reminder_type == "work_session" ? 'check in at' : 'set a reminder for';
		var reminderOrCheckInExample = reminder_type == "work_session" ? '`i.e. halfway done by 4pm`' : '`i.e. pick up laundry at 8pm`';

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
					var _message$intentObject = message.intentObject.entities;
					var reminder = _message$intentObject.reminder;
					var duration = _message$intentObject.duration;
					var datetime = _message$intentObject.datetime;

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

					convo.ask('What time would you like me to ' + reminderOrCheckInString + '? Leave a note in the same line if you want me to remember it for you ' + reminderOrCheckInExample, function (response, convo) {
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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map