'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/**
 * Starting a new plan for the day
 */

// base controller for new plan


exports.default = function (controller) {

	controller.hears(['start_day'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('new_plan_flow', [bot, { SlackUserId: SlackUserId }]);
		}, 1000);
	});

	/**
 * 	~ NEW PLAN FOR YOUR DAY ~
 * 	1) get your 3 priorities
 * 	2) make it easy to prioritize in order for the day
 * 	3) enter work sessions for each of them
 */

	controller.on('new_plan_flow', function (bot, config) {
		var SlackUserId = config.SlackUserId;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			var UserId = user.id;
			var tz = user.SlackUser.tz;


			var daySplit = (0, _miscHelpers.getCurrentDaySplit)(tz);

			user.getSessionGroups({
				where: ['"SessionGroup"."type" = ? AND "SessionGroup"."createdAt" > ?', "start_work", _constants.dateOfNewPlanDayFlow],
				limit: 1
			}).then(function (sessionGroups) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					var name = user.nickName || user.email;
					convo.name = name;

					convo.newPlan = {
						SlackUserId: SlackUserId,
						tz: tz,
						daySplit: daySplit,
						onboardVersion: false,
						prioritizedTasks: [],
						startTask: {
							index: 0, // fail-safe default. should get updated in flow
							minutes: 30 // fail-safe default. should get updated in flow
						},
						startTime: false, // default will be now
						includeSlackUserIds: []
					};

					var day = (0, _momentTimezone2.default)().tz(tz).format('dddd');

					if (sessionGroups.length == 0) {
						convo.newPlan.onboardVersion = true;
					}

					if (!convo.newPlan.onboardVersion) {
						convo.say('Happy ' + day + ', ' + name + '! Let\'s win the ' + daySplit + ' :muscle:');
					}

					(0, _plan.startNewPlanFlow)(convo);

					// on finish conversation
					convo.on('end', function (convo) {
						var newPlan = convo.newPlan;
						var exitEarly = newPlan.exitEarly;
						var prioritizedTasks = newPlan.prioritizedTasks;
						var startTask = newPlan.startTask;
						var startTime = newPlan.startTime;


						(0, _miscHelpers.closeOldRemindersAndSessions)(user);

						if (exitEarly) {
							return;
						}

						// we only know minutes information of first task
						startTask.taskObject = _extends({}, prioritizedTasks[startTask.index], {
							minutes: startTask.minutes
						});

						prioritizedTasks.splice(startTask.index, 1);
						prioritizedTasks.unshift(startTask.taskObject); // put this in first

						// first turn off all existing daily tasks
						user.getDailyTasks({
							where: ['"DailyTask"."type" = ?', "live"]
						}).then(function (dailyTasks) {
							var dailyTaskIds = dailyTasks.map(function (dailyTask) {
								return dailyTask.id;
							});
							if (dailyTaskIds.length == 0) {
								dailyTaskIds = [0];
							};
							_models2.default.DailyTask.update({
								type: "archived"
							}, {
								where: ['"DailyTasks"."id" IN (?)', dailyTaskIds]
							}).then(function (dailyTasks) {
								prioritizedTasks.forEach(function (task, index) {
									var priority = index + 1;
									var text = task.text;
									var minutes = task.minutes;

									_models2.default.Task.create({
										text: text
									}).then(function (task) {
										task.createDailyTask({
											minutes: minutes,
											priority: priority,
											UserId: UserId
										});
									});
								});
							});
						});

						if (startTime) {
							// when the reminder comes, it will ask for the highest priority
							// task that is not done yet. right now schema is: when user
							// decides to work on something else, it will put that as highest 
							// priorty. does highest priority mean doing it first?
							_models2.default.Reminder.create({
								UserId: UserId,
								remindTime: startTime,
								type: "start_work"
							});
						}

						console.log("here is new plan object:\n");
						console.log(convo.newPlan);
						console.log("\n\n\n");

						setTimeout(function () {
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						}, 1250);

						// placeholder for keep going
						if (newPlan) {} else {
							// default premature end
							bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
								(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
								convo.say("Okay! Let me know when you want to plan for today");
								convo.next();
							});
						}
					});
				});
			});
		});
	});
};

var _index = require('../index');

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _models = require('../../../app/models');

var _models2 = _interopRequireDefault(_models);

var _botResponses = require('../../lib/botResponses');

require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _constants = require('../../lib/constants');

var _plan = require('../modules/plan');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map