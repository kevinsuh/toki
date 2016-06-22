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
	yes: new RegExp(/(^(yes|yea|yup|yep|ya|sure|ok|y|yeah|yah)|\by[esahp]{2,}\b|\bs[ure]{2,}\b)/i),
	no: new RegExp(/(^(no|nah|nope|n)|\bn[oahpe]+\b)/i)
}