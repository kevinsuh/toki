// this is the file to add
// functionality to the bot
export default function(bot) {
	console.log("Currently beefing up navi bot");

	addHearUtterances(bot);
	bot.timer = null;

}

// this lets me add hear utterances
// for the controller to store
let addHearUtterances = (bot) => {
	var hearUtterances = {};

	// hello words
	hearUtterances.hello = ["^([hi]{0,5}$|hello{0,8}$|hey{0,5}$|yo{0,4}$|sup{0,5}$|holla{0,5}$)"];

	// numbers
	var numbers = new Array(100);
	for (var i = 0; i < i.length; i++) {
		numbers[i] = i;
	}
	hearUtterances.number = i;

	bot.utterances.hears = hearUtterances;
}