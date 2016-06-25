// this contains responses that is randomized to keep things fresh and funky

// respond to hello
export function helloResponse() {

	var helloResponses = [
		"Hey!",
		"Hello :)",
		"Hola",
		"Hello!",
		"Heyya",
		"Hey there"
	];
	return randomSelection(helloResponses);
}


// randomly returns a response from array
function randomSelection(responseArray) {
	var min = 0;
	var max = responseArray.length;

	const randomIndex = Math.floor(Math.random() * (max - min)) + min;

	return responseArray[randomIndex];
}

export function randomInt(min, max) {
	var randomIndex = Math.floor(Math.random() * (max - min)) + min;
	return randomIndex;
}

export const utterances = {
	yes: new RegExp(/(^(yes|yea|yup|yep|ya|sure|ok|y|yeah|yah)|\by[esahp]{2,}\b|\bs[ure]{2,}\b|\bs[tart]{2,}\b)/i),
	no: new RegExp(/(^(no|nah|nope|n)|\bn[oahpe]+\b)/i),
	containsNew: new RegExp(/(\bn[new]{2,}\b)/i),
	containsCheckin: new RegExp(/(\bch[check in]{3,}\b)/i),
	containsChangeTask: new RegExp(/(ch[change ]{3,}t[task ]{2,})/i),
	containsChangeTime: new RegExp(/(ch[change ]{3,}t[time ]{2,})/i),
	containsAddNote: new RegExp(/(a[add ]{1,}n[note ]{2,})/i),
	containsBreak: new RegExp(/(\bb[break ]{3,}\b)/i),
	containsBackLater: new RegExp(/(b[back ]{2,}l[later ]{2,})/i),
	startSession:  new RegExp(/((s[start ]{2,}|n[new ]{2,}|w[work ]{2,})|s[session]{2,})/i),
	containsEnd: new RegExp(/(e[end]{2,})/i),
	containsNone: new RegExp(/((no|none|didnt|didn't)|\bn[otahpe]+\b)/i),
	containsDifferent: new RegExp(/((\bdi[different]{4,}\b)|(\b[else ]{3,}\b))/i)
}