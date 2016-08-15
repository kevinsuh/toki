'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.test = test;
exports.seedAndUpdateUsers = seedAndUpdateUsers;

var _controllers = require('../bot/controllers');

var _miscHelpers = require('../bot/lib/miscHelpers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		For fun one-off thingz
 */

function test(bot) {

	// this to delete their last message if it was a morning ping!
	var SlackUserId = '';
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

// sequelize models
function seedAndUpdateUsers(members, bot) {

	members.forEach(function (member) {
		var id = member.id;
		var team_id = member.team_id;
		var name = member.name;
		var tz = member.tz;


		var SlackUserId = id;

		_models2.default.SlackUser.find({
			where: { SlackUserId: SlackUserId }
		}).then(function (slackUser) {

			if (slackUser) {

				slackUser.update({
					TeamId: team_id,
					SlackName: name
				});

				_models2.default.User.find({
					where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
					include: [_models2.default.SlackUser]
				}).then(function (user) {

					if (member.profile && member.profile.email) {
						var email = member.profile.email;

						if (email && user.email == '') {
							console.log('updating email!');
							user.update({
								email: email
							});
						}
					}
				});
			} else {
				(function () {

					var email = '';
					if (member.profile && member.profile.email) email = member.profile.email;

					_models2.default.User.find({
						where: ['"email" = ?', email],
						include: [_models2.default.SlackUser]
					}).then(function (user) {

						if (user) {

							if (user.SlackUser) {
								console.log('\n\n USER FOUND WITHOUT SLACKUSER (' + name + ')... FIXING THAT ... \n\n');
								user.SlackUser.update({
									UserId: user.id
								});
							} else {

								console.log('\n\n CREATING UNIQUE USER (' + name + ') ... \n\n');
								// more common situation
								user.update({
									email: email,
									nickName: name
								}).then(function (user) {
									_models2.default.SlackUser.create({
										SlackUserId: SlackUserId,
										UserId: user.id,
										tz: tz,
										TeamId: team_id,
										SlackName: name
									}).then(function (slackUser) {
										// if slack user created, should be onboarded
										_controllers.controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
									});
								});
							}
						}
					});
				})();
			}
		});
	});
}

function makeid() {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < 10; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}return text;
}
//# sourceMappingURL=scripts.js.map