"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getTimeZoneOffsetForUser = getTimeZoneOffsetForUser;
exports.seedDatabaseWithExistingSlackUsers = seedDatabaseWithExistingSlackUsers;

var _models = require("../../app/models");

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 		HELPERS THAT DEAL WITH SLACK API CALLS
 */

/**
 * get timezone for the user through slack API
 * @param  object bot the bot that is running...
 * @param  string slackUserID slack user id
 * @return {string}             timezone in format...
 */
function getTimeZoneOffsetForUser(bot, slackUserID) {

	console.log("inside time offset user!");

	if (!slackUserID || !bot) return;

	bot.api.users.list({
		presence: 1
	}, function (err, response) {

		console.log("Called Users List inside getTimeZoneOffsetForUser!");

		var members = response.members; // members are all users registered to your bot

		for (var i = 0; i < members.length; i++) {
			if (members[i].id == slackUserID) {
				var timeZoneObject = {};
				timeZoneObject.tz = members[i].tz;
				timeZoneObject.tz_label = members[i].tz_label;
				timeZoneObject.tz_offset = members[i].tz_offset;
				return timeZoneObject;
			}
		};
	});
}

/**
 * this will seed our database with our existing slack bot users
 * if this slack userID already exists in DB, will not re-seed
 * @param  {bot} bot our bot
 */
function seedDatabaseWithExistingSlackUsers(bot) {

	bot.api.users.list({
		presence: 1
	}, function (err, response) {
		var members = response.members; // members are all users registered to your bot

		console.log("Seeding these members:");
		console.log(members);
		console.log("\n\n\n\n\n");

		_models2.default.User.findAll({}).then(function (users) {
			var numberOfExistingUsers = users.length;
			var count = 1;
			var emailCount = 1;
			members.forEach(function (member) {
				var SlackUserId = member.id;
				var nickName = member.name;
				emailCount++;
				var email = "TEMPEMAILHOLDER@TEMPORARY.COM" + (numberOfExistingUsers + emailCount);

				_models2.default.SlackUser.find({
					where: { SlackUserId: SlackUserId }
				}).then(function (slackUser) {
					if (!slackUser) {
						_models2.default.User.create({
							email: email,
							nickName: nickName
						}).then(function (user) {
							_models2.default.SlackUser.create({
								SlackUserId: SlackUserId,
								UserId: user.id,
								tz: member.tz
							});
						});
						console.log("Seeding user number " + count + "...");
						count++;
					}
				});
			});
		});
	});
}
//# sourceMappingURL=slackApiHelpers.js.map