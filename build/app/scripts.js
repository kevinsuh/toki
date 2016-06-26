'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.updateUsers = updateUsers;
exports.seedUsers = seedUsers;

var _controllers = require('../bot/controllers');

var _models = require('./models');

var _models2 = _interopRequireDefault(_models);

var _momentTimezone = require('moment-timezone');

var _momentTimezone2 = _interopRequireDefault(_momentTimezone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// sequelize models
// for one-off thingz
function updateUsers() {

	var allUsers = [];
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
				// var data = {
				// 	SlackUserId: id,
				// 	TeamId: team_id,
				// 	nickName: name,
				// 	tz
				// };

				_models2.default.SlackUser.find({
					where: { SlackUserId: id }
				}).then(function (slackUser) {
					if (slackUser) {
						slackUser.update({
							TeamId: team_id,
							tz: tz
						});
						_models2.default.User.find({
							where: ['"SlackUser"."SlackUserId" = ?', id],
							include: [_models2.default.SlackUser]
						}).then(function (user) {
							user.update({
								nickName: name
							});
						});
					}
				});
			});
		});
	}
}

function seedUsers() {

	var allUsers = [];
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

				var data = {
					SlackUserId: id,
					TeamId: team_id,
					nickName: name,
					tz: tz
				};
				allUsers.push(data);
			});

			allUsers.forEach(function (user) {
				var SlackUserId = user.SlackUserId;
				var TeamId = user.TeamId;
				var nickName = user.nickName;
				var tz = user.tz;

				_models2.default.SlackUser.find({
					where: { SlackUserId: SlackUserId }
				}).then(function (slackUser) {
					// only create uniques
					if (!slackUser) {
						var uniqueEmail = makeid();
						_models2.default.User.create({
							email: 'TEMPEMAILHOLDER' + uniqueEmail + '@gmail.com',
							nickName: nickName
						}).then(function (user) {
							_models2.default.SlackUser.create({
								SlackUserId: SlackUserId,
								UserId: user.id,
								tz: tz,
								TeamId: TeamId
							});
						});
					}
				});
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