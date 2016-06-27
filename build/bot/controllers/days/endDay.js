'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	// programmatic trigger of actual day start flow: `end_day_flow`
	controller.on('trigger_day_end', function (bot, config) {
		var SlackUserId = config.SlackUserId;

		controller.trigger('end_day_flow', [bot, { SlackUserId: SlackUserId }]);
	});

	/**
  * 		User directly asks to end day
  * 				~* via Wit *~
  * 			confirm for `end_day_flow`
  */
	controller.hears(['end_day'], 'direct_message', _index.wit.hears, function (bot, message) {

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

				// ping to start a day if they have not yet
				user.getSessionGroups({
					order: '"SessionGroup"."createdAt" DESC',
					limit: 1
				}).then(function (sessionGroups) {

					// should start day
					var shouldStartDay = false;
					if (sessionGroups.length == 0) {
						shouldStartDay = true;
					} else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
						shouldStartDay = true;
					}
					if (shouldStartDay) {
						bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
							convo.say("You have not started a day yet! Let me know when you want to `start a day` together :smile:");
							convo.next();
						});
						return;
					}

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						var name = user.nickName || user.email;
						convo.name = name;
						convo.readyToEndDay = false;

						convo.ask('Hey ' + name + '! Would you like to end your day?', [{
							pattern: _botResponses.utterances.yes,
							callback: function callback(response, convo) {
								convo.readyToEndDay = true;
								convo.next();
							}
						}, {
							pattern: _botResponses.utterances.no,
							callback: function callback(response, convo) {
								convo.say("Okay. I'm here whenever you're ready to end your day :wave:");
								convo.next();
							}
						}, {
							default: true,
							callback: function callback(response, convo) {
								convo.say("Couldn't quite catch that. I'll be here when you're ready to `end your day` :wave:");
								convo.next();
							}
						}]);
						convo.on('end', function (convo) {
							if (convo.readyToEndDay) {
								controller.trigger('end_day_flow', [bot, { SlackUserId: SlackUserId }]);
							}
						});
					});
				});
			});
		}, 1000);
	});

	/**
 * 	~ ACTUAL END OF YOUR DAY ~
 * 		* Show completed tasks
 * 		* Show total time of focused sessions
 * 		* Ask for reflection
 * 		* 
 * 		
 */
	controller.on('end_day_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// get the most recent start_work session group to measure
			// a day's worth of work
			user.getSessionGroups({
				order: '"SessionGroup"."createdAt" DESC',
				limit: 1
			}).then(function (sessionGroups) {

				// should start day
				var shouldStartDay = false;
				if (sessionGroups.length == 0) {
					shouldStartDay = true;
				} else if (sessionGroups[0] && sessionGroups[0].type == "end_work") {
					shouldStartDay = true;
				}
				if (shouldStartDay) {
					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
						convo.say("You have not started a day yet! Let's `start a day` together :smile:");
						convo.next();
					});
					return;
				}

				var startSessionGroup = sessionGroups[0]; // the start day
				var startSessionGroupTime = (0, _momentTimezone2.default)(startSessionGroup.dataValues.createdAt);

				user.getDailyTasks({
					where: ['"DailyTask"."createdAt" > ? AND "Task"."done" = ? AND "DailyTask"."type" = ?', startSessionGroupTime, true, "live"],
					include: [_models2.default.Task],
					order: '"DailyTask"."priority" ASC'
				}).then(function (dailyTasks) {

					bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

						var name = user.nickName || user.email;
						convo.name = name;

						convo.dayEnd = {
							UserId: user.id,
							endDayDecision: false // what does user want to do with day
						};

						dailyTasks = (0, _messageHelpers.convertToSingleTaskObjectArray)(dailyTasks, "daily");
						convo.dayEnd.dailyTasks = dailyTasks;
						convo.dayEnd.startSessionGroup = startSessionGroup;

						startEndDayFlow(err, convo);

						// on finish conversation
						convo.on('end', function (convo) {

							var responses = convo.extractResponses();

							console.log('done!');
							console.log("here is end day object:\n\n\n");
							console.log(convo.dayEnd);
							console.log("\n\n\n");

							if (convo.status == 'completed') {
								var _convo$dayEnd = convo.dayEnd;
								var UserId = _convo$dayEnd.UserId;
								var reflection = _convo$dayEnd.reflection;
								var _dailyTasks = _convo$dayEnd.dailyTasks;
								var _startSessionGroup = _convo$dayEnd.startSessionGroup;

								var _startSessionGroupTime = (0, _momentTimezone2.default)(_startSessionGroup.dataValues.createdAt);

								var now = (0, _momentTimezone2.default)();

								// log `end_work` and reflection
								_models2.default.SessionGroup.create({
									type: "end_work",
									UserId: UserId,
									reflection: reflection
								});

								// end all open work sessions. should only be one for the user
								user.getWorkSessions({
									where: ['"open" = ?', true]
								}).then(function (workSessions) {
									workSessions.forEach(function (workSession) {
										workSession.update({
											endTime: now,
											open: false
										});
									});
								});

								// put all of user's `live` tasks to pending
								// make all pending tasks => archived, then all live tasks => pending
								user.getDailyTasks({
									where: ['"DailyTask"."type" = ?', "pending"]
								}).then(function (dailyTasks) {
									dailyTasks.forEach(function (dailyTask) {
										dailyTask.update({
											type: "archived"
										});
									});
									user.getDailyTasks({
										where: ['"DailyTask"."type" = ?', "live"]
									}).then(function (dailyTasks) {
										dailyTasks.forEach(function (dailyTask) {
											dailyTask.update({
												type: "pending"
											});
										});
									});
								});
							} else {
								// default premature end
								bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
									convo.say("Okay! Exiting now. Let me know when you want to start your day!");
									convo.next();
								});
							}
						});
					});
				});
			});
		});
	});
};

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _index = require('../index');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

var _messageHelpers = require('../../lib/messageHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

// start of end day flow


// base controller for end day
function startEndDayFlow(response, convo) {
	var task = convo.task;
	var name = convo.name;
	var bot = task.bot;
	var source_message = task.source_message;
	var dailyTasks = convo.dayEnd.dailyTasks;


	convo.say('Let\'s wrap up for the day :package:');

	if (dailyTasks.length > 0) {
		convo.say('Here are the tasks you completed today:');
		var taskListMessage = (0, _messageHelpers.convertArrayToTaskListMessage)(dailyTasks);
		convo.say(taskListMessage);
	}

	getTotalWorkSessionTime(response, convo);
}

// calculate total work session time before continuing
function getTotalWorkSessionTime(response, convo) {
	var task = convo.task;
	var name = convo.name;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$dayEnd2 = convo.dayEnd;
	var UserId = _convo$dayEnd2.UserId;
	var dailyTasks = _convo$dayEnd2.dailyTasks;
	var startSessionGroup = _convo$dayEnd2.startSessionGroup;


	var startSessionGroupTime = (0, _momentTimezone2.default)(startSessionGroup.dataValues.createdAt);
	var now = (0, _momentTimezone2.default)();

	// get all the work sessions started between now and most recent startSessionGroup
	_models2.default.User.find({
		where: { id: UserId }
	}).then(function (user) {
		return user.getWorkSessions({
			where: ['"WorkSession"."startTime" > ?', startSessionGroupTime]
		});
	}).then(function (workSessions) {
		var totalFocusedMinutes = 0;
		// calculate time between these
		workSessions.forEach(function (workSession) {
			var startTime = (0, _momentTimezone2.default)(workSession.startTime);
			var endTime = (0, _momentTimezone2.default)(workSession.endTime);

			// for the scenario they are ending day to end a session
			// we will do actual updates at `convo.on('end')`
			if (endTime > now) endTime = now;
			var minutesDuration = Math.round(_momentTimezone2.default.duration(endTime.diff(startTime)).asMinutes());
			totalFocusedMinutes += minutesDuration;
		});
		convo.say('You spent ' + totalFocusedMinutes + ' minutes in focused sessions with me');
		askForReflection(response, convo);
	});
}

// ask if user wants reflection
function askForReflection(response, convo) {
	var task = convo.task;
	var name = convo.name;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$dayEnd3 = convo.dayEnd;
	var dailyTasks = _convo$dayEnd3.dailyTasks;
	var startSessionGroup = _convo$dayEnd3.startSessionGroup;


	convo.say('Is there anything specific you\'d like to remember about your work day? :pencil:');
	convo.say('I\'ll remember this for you and be able to present it back to you soon :bulb:');
	convo.ask('This could be how you felt about your time, focus, or anything else!', [{
		pattern: _botResponses.utterances.yes,
		callback: function callback(response, convo) {
			convo.ask('Awesome! What would you like to remember about today?', function (response, convo) {
				getReflectionText(response, convo);
				convo.next();
			});
			convo.next();
		}
	}, {
		pattern: _botResponses.utterances.no,
		callback: function callback(response, convo) {
			convo.say("Totally cool! :thumbsup:");
			convo.say("See you tomorrow! :wave:");
			convo.next();
		}
	}, {
		default: true,
		callback: function callback(response, convo) {
			getReflectionText(response, convo);
			convo.next();
		}
	}]);

	convo.next();
}

// get reflection and end the day
function getReflectionText(response, convo) {
	var task = convo.task;
	var name = convo.name;
	var bot = task.bot;
	var source_message = task.source_message;
	var _convo$dayEnd4 = convo.dayEnd;
	var dailyTasks = _convo$dayEnd4.dailyTasks;
	var startSessionGroup = _convo$dayEnd4.startSessionGroup;

	var responseMessage = response.text;

	// for now it is single enter that will be saved as the reflection
	convo.dayEnd.reflection = responseMessage;
	convo.say('Great!');
	convo.say("See you tomorrow! :wave:");
}
//# sourceMappingURL=endDay.js.map