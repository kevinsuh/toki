// this is the file to add
// functionality to the bot
export default function(bot) {
	console.log("Currently beefing up navi bot");

	addUtterances(bot);
	addHearUtterances(bot);

}

let addUtterances = (bot) => {
	var newUtterances = {};
	newUtterances.hello = /^(hi|hello|hey|h|yo|sup|holla)/i;

	for (var key in newUtterances) {
		bot.utterances[key] = newUtterances[key];
	}

}

// this lets me add hear utterances
// for the controller to store
let addHearUtterances = (bot) => {
	var hearUtterances = {};

	// hello words
	hearUtterances.hello = ["hi", "hey", "sup", "yo", "holla", "hello", "hola"];

	// numbers
	var numbers = new Array(100);
	for (var i = 0; i < i.length; i++) {
		numbers[i] = i;
	}
	hearUtterances.number = i;

	bot.utterances.hears = hearUtterances;
}