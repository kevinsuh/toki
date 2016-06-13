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