"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.helloResponse = helloResponse;
exports.randomInt = randomInt;
// this contains responses that is randomized to keep things fresh and funky

// respond to hello
function helloResponse() {

	var helloResponses = ["Hey!", "Hello :)", "Hola", "Hello!", "Heyya", "Hey there"];
	return randomSelection(helloResponses);
}

// randomly returns a response from array
function randomSelection(responseArray) {
	var min = 0;
	var max = responseArray.length;

	var randomIndex = Math.floor(Math.random() * (max - min)) + min;

	return responseArray[randomIndex];
}

function randomInt(min, max) {
	var randomIndex = Math.floor(Math.random() * (max - min)) + min;
	return randomIndex;
}

var utterances = exports.utterances = {
	yes: new RegExp(/(^(yes|yea|yup|yep|ya|sure|ok|y|yeah|yah)|\by[esah]{2,}\b|\bs[ure]{2,}\b)/i),
	no: new RegExp(/(^(no|nah|nope|n)|\bn[oahpe]+\b)/i)
};
//# sourceMappingURL=botResponses.js.map