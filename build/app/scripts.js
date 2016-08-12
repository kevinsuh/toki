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

function test() {
	_models2.default.SlackUser.find({
		where: ['"SlackUser"."SlackUserId" = ?', "U121ZK15J"]
	}).then(function (slackUser) {
		slackUser.getIncluded({
			include: [_models2.default.User]
		}).then(function (includedSlackUsers) {
			console.log("got slack users included!");
			console.log(includedSlackUsers);
		});
	});
}

// sequelize models
function seedAndUpdateUsers(members) {

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
								_models2.default.User.create({
									nickName: name,
									email: email
								}).then(function (user) {
									_models2.default.SlackUser.create({
										SlackUserId: SlackUserId,
										UserId: user.id,
										tz: tz,
										TeamId: team_id,
										SlackName: name
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