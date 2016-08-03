'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (controller) {

	/**
  *
  * 		User directly asks to start a session
  * 							~* via Wit *~
  * 		     this makes sure you are properly in
  * 		     				in a "SessionGroup" before
  * 		     			working on your session
  */
	controller.hears(['start_session'], 'direct_message', _index.wit.hears, function (bot, message) {

		var SlackUserId = message.user;
		var text = message.text;


		var config = {
			planDecision: _constants.constants.PLAN_DECISION.work.word,
			SlackUserId: SlackUserId,
			message: message
		};

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(function () {
			controller.trigger('plan_command_center', [bot, config]);
		}, 750);
	});

	/**
  * 		ACTUAL START SESSION FLOW
  * 		this will begin the start_session flow with user
  *
  * 			- start work session
  * 			- show and decide tasks to work on
  * 			- decide session duration
  */
	controller.on('begin_session', function (bot, config) {
		var SlackUserId = config.SlackUserId;
		var dailyTaskToWorkOn = config.dailyTaskToWorkOn;
		var currentSession = config.currentSession;


		_models2.default.User.find({
			where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
			include: [_models2.default.SlackUser]
		}).then(function (user) {

			// need user's timezone for this flow!
			var tz = user.SlackUser.tz;

			var UserId = user.id;

			if (!tz) {
				bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {
					convo.say("Ah! I need your timezone to continue. Let me know when you're ready to `configure timezone` together");
				});
				return;
			}

			bot.startPrivateConversation({ user: SlackUserId }, function (err, convo) {

				convo.sessionStart = {
					SlackUserId: SlackUserId,
					UserId: UserId,
					tz: tz,
					bot: bot,
					currentSession: currentSession
				};

				if (dailyTaskToWorkOn) {
					convo.sessionStart.dailyTask = dailyTaskToWorkOn;
				} else {
					convo.say('Hey! Time to start on a work session :smiley:');
				}

				(0, _startWorkSessionFunctions.finalizeTimeAndTasksToStart)(convo);
				convo.next();

				convo.on('end', function (convo) {

					console.log("\n\n\n end of start session ");
					console.log(convo.sessionStart);
					console.log("\n\n\n");

					if (convo.confirmStart) {
						(0, _miscHelpers.closeOldRemindersAndSessions)(user);
						setTimeout(function () {
							(0, _startWorkSessionFunctions.startSessionWithConvoObject)(convo.sessionStart);
						}, 500);
					} else {
						setTimeout(function () {
							(0, _index.resumeQueuedReachouts)(bot, { SlackUserId: SlackUserId });
						}, 750);
					}
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

var _messageHelpers = require('../../lib/messageHelpers');

var _miscHelpers = require('../../lib/miscHelpers');

var _intents = require('../../lib/intents');

var _intents2 = _interopRequireDefault(_intents);

var _botResponses = require('../../lib/botResponses');

var _constants = require('../../lib/constants');

var _startWorkSessionFunctions = require('../modules/startWorkSessionFunctions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=startWorkSession.js.map