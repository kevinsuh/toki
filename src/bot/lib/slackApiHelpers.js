import models from '../../app/models';

/**
 * 		HELPERS THAT DEAL WITH SLACK API CALLS
 */

/**
 * get timezone for the user through slack API
 * @param  object bot the bot that is running...
 * @param  string slackUserID slack user id
 * @return {string}             timezone in format...
 */
export function getTimeZoneOffsetForUser(bot, slackUserID) {

	console.log("inside time offset user!");

	if (!slackUserID || !bot)
		return;

	bot.api.users.list({
  	presence: 1
  }, (err, response) => {

  	console.log("Called Users List inside getTimeZoneOffsetForUser!");

  	const { members } = response; // members are all users registered to your bot

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
export function seedDatabaseWithExistingSlackUsers(bot) {

	bot.api.users.list({
  	presence: 1
  }, (err, response) => {

		const { members } = response; // members are all users registered to your bot

		console.log("Seeding these members:");
		console.log(members);
		console.log("\n\n\n\n\n");
		
		models.User.findAll({})
		.then((users) => {
			var numberOfExistingUsers = users.length;
			var count = 1;
			var emailCount = 1;
			members.forEach((member) => {
				const SlackUserId = member.id;
				const nickName = member.name;
				emailCount++;
				const email = `TEMPEMAILHOLDER@TEMPORARY.COM${numberOfExistingUsers + emailCount}`;

				models.SlackUser.find({
					where: { SlackUserId }
				}).then((slackUser) => {
					if (!slackUser) {
						models.User.create({
							email,
							nickName
						}).then((user) => {
							models.SlackUser.create({
								SlackUserId,
								UserId: user.id,
								tz: member.tz
							})
						});
						console.log(`Seeding user number ${count}...`);
						count++;
					}
				});

			});
		});
		
	});

}