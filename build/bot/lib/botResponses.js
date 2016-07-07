"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _utterances;

exports.helloResponse = helloResponse;
exports.randomInt = randomInt;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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

var utterances = exports.utterances = (_utterances = {
	yes: new RegExp(/((yes|yea|yup|yep|ya|sure|ok|yeah|yah|ye)|(\bd[o ]+[this]{2,})|(\bd[o ]+[it]+)|\by[esahp]{2,}\b|\bs[ure]{2,}\b|\bs[tart]{2,}\b)/i),
	no: new RegExp(/(^(no|nah|nope|n)|\bn[oahpe]+\b)/i),
	noAndNeverMind: new RegExp(/((no|nah|nope)|\bn[oahpe]+\b|\bn[never mind]{4,}\b|[nvm]{2,})/i),
	specificYes: new RegExp(/((yes|yea|yup|yep|ya|sure|ok|yeah|yah|ye)|\by[esahp]{2,}\b|\bs[ure]{2,}\b)/i),
	containsNew: new RegExp(/(\bn[new]{2,}\b)/i),
	containsCheckin: new RegExp(/(\bch[check in]{3,}\b|r[reminder ]{4,})/i),
	containsChangeTask: new RegExp(/(ch[change ]{3,}t[task ]{2,})/i),
	containsChangeTime: new RegExp(/(ch[change ]{3,}t[time ]{2,})/i),
	containsAddNote: new RegExp(/(a[add ]{1,}n[note ]{2,})/i),
	containsBreak: new RegExp(/(\bbr[reak ]{2,}\b)/i),
	containsBackLater: new RegExp(/(b[back ]{2,}l[later ]{2,})/i),
	startSession: new RegExp(/((s[start ]{2,}|n[new ]{2,}|w[work ]{2,})|s[session]{2,})/i),
	containsEnd: new RegExp(/(e[end]{2,})/i),
	containsNone: new RegExp(/((no|none|didnt|didn't)|\bn[otahpe]+\b)/i),
	containsDifferent: new RegExp(/((\bdi[different]{4,}\b)|(\b[else ]{3,}\b))/i)
}, _defineProperty(_utterances, "containsNone", new RegExp(/\b[none]{2,}\b/i)), _defineProperty(_utterances, "containsNumber", new RegExp(/\d/i)), _defineProperty(_utterances, "containsAdd", new RegExp(/a[add]{1,}/i)), _defineProperty(_utterances, "containsTask", new RegExp(/t[task]{2,}/i)), _defineProperty(_utterances, "containsName", new RegExp(/n[name]{2,}/i)), _defineProperty(_utterances, "containsTimeZone", new RegExp(/t[timezone ]{4,}/i)), _defineProperty(_utterances, "containsPlan", new RegExp(/p[plan ]{2,}/i)), _utterances);
//# sourceMappingURL=botResponses.js.map