'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

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


			var dateOfNewPlanDayFlow = "2016-07-30";
			var daySplit = (0, _miscHelpers.getCurrentDaySplit)(tz);

			user.getSessionGroups({
				where: ['"SessionGroup"."type" = ? AND "SessionGroup"."createdAt" > ?', "start_work", dateOfNewPlanDayFlow],
				limit: 1
			}).then(function (sessionGroups) {

				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

					var name = user.nickName || user.email;
					convo.name = name;

					convo.newPlan = {
						tz: tz,
						daySplit: daySplit,
						autoWizard: false,
						prioritizedTasks: [],
						startTaskIndex: false
					};

					var day = "day";
					if (daySplit != _constants.constants.MORNING.word) {
						day = daySplit;
					}
					convo.say('Hey ' + name + '! Let\'s win the ' + daySplit + ' :muscle:');

					if (sessionGroups.length == 0) {
						convo.newPlan.autoWizard = true;
					}

					(0, _plan.startNewPlanFlow)(convo);

					// on finish conversation
					convo.on('end', function (convo) {
						var newPlan = convo.newPlan;


						console.log('done!');
						console.log("here is new plan object:\n\n\n");
						console.log(convo.newPlan);
						console.log("\n\n\n");

						(0, _miscHelpers.closeOldRemindersAndSessions)(user);

						setTimeout(function () {
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						}, 750);

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