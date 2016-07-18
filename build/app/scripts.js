'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; }; /**
                                                                                                                                                                                                                                                   * 		For fun one-off thingz
                                                                                                                                                                                                                                                   */

// sequelize models


exports.updateUsers = updateUsers;
exports.seedUsers = seedUsers;

var _controllers = require('../bot/controllers');

var _miscHelpers = require('../bot/lib/miscHelpers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function updateUsers() {

	var env = process.env.NODE_ENV || 'development';
	if (env == 'development') {
		(0, _miscHelpers.consoleLog)("In development server of Toki");
		process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
	}

	for (var token in _controllers.bots) {

		// only dev for dev! and prod for prod!
		if (token == process.env.BOT_TOKEN) {
			(function () {

				var bot = _controllers.bots[token];

				bot.api.users.list({
					presence: 1
				}, function (err, response) {
					var members = response.members; // all members registered with your bot

					members.forEach(function (member) {

						console.log('updating member:');

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
									tz: tz
								});

								_models2.default.User.find({
									where: ['"SlackUser"."SlackUserId" = ?', SlackUserId],
									include: [_models2.default.SlackUser]
								}).then(function (user) {

									if (member.profile && member.profile.email) {
										var email = member.profile.email;

										if (email) {
											console.log('email found!');
											user.update({
												email: email,
												nickName: name
											});
											return;
										}
									}
								});
							} else {

								// create slack user!
								// set through onboarding flow if first time user
								_models2.default.SlackUser.create({
									SlackUserId: SlackUserId,
									TeamId: team_id,
									tz: tz
								}).then(function (slackUser) {

									if (member.profile && member.profile.email) {
										var _ret2 = function () {
											var email = member.profile.email;

											if (!email) {
												console.log("no email found");
												return {
													v: void 0
												};
											}

											_models2.default.User.find({
												where: ['"email" = ?', email]
											}).then(function (user) {

												if (user) {

													user.update({
														nickName: name
													});
													slackUser.update({
														UserId: user.id
													}).then(function (slackUser) {
														_controllers.controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
													});
												} else {

													_models2.default.User.create({
														email: email,
														nickName: name
													}).then(function (user) {
														var UserId = user.id;
														slackUser.update({
															UserId: UserId
														}).then(function (slackUser) {
															_controllers.controller.trigger('begin_onboard_flow', [bot, { SlackUserId: SlackUserId }]);
														});
													});
												}
											});
										}();

										if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
									}
								});
							}
						});
					});
				});
			})();
		}
	}
}

function seedUsers() {

	return;

	var slackUserIds = []; // make sure only unique slack user ids are put in!
	for (var token in _controllers.bots) {

		_controllers.bots[token].api.users.list({
			presence: 1
		}, function (err, response) {
			var members = response.members; // all members registered with your bot

			members.forEach(function (member) {
				var id = member.id;
				var team_id = member.team_id;
				var name = member.name;
				var tz = member.tz;

				// this helps us stay unique with SlackUserId

				if (slackUserIds.indexOf(id) < 0) {
					slackUserIds.push(id);
					_models2.default.SlackUser.find({
						where: { SlackUserId: id }
					}).then(function (slackUser) {
						if (!slackUser) {
							(0, _miscHelpers.consoleLog)("Unique SlackUserId found... creating now");
							var uniqueEmail = makeid();
							_models2.default.User.create({
								email: 'TEMPEMAILHOLDER' + uniqueEmail + '@gmail.com',
								nickName: name
							}).then(function (user) {
								_models2.default.SlackUser.create({
									SlackUserId: id,
									UserId: user.id,
									tz: tz,
									TeamId: team_id
								});
							});
						}
					});
				}
			});
		});
	}
}

function makeid() {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < 10; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}return text;
}
//# sourceMappingURL=scripts.js.map