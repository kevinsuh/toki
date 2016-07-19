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
	yes: new RegExp(/((yes|yea|yup|yep|ya|sure|ok|okay|yeah|yah|ye)\b|(\bd[o ]+[this]{2,})|(\bd[o ]+[it]+)|\by[esahp]{2,}\b|\bs[ure]{2,}\b|\bs[tart]{2,}\b)/i),
	no: new RegExp(/(^(no|nah|nope|n)|\bn[oahpe]+\b)/i),
	noAndNeverMind: new RegExp(/(\b(no|nah|nope)|\bn[oahpe]+\b|\bn[never mind]{4,}\b|[nvm]{2,})/i),
	startsWithNever: new RegExp(/^ne[never]{3,}\b/i),
	specificYes: new RegExp(/((yes|yea|yup|yep|ya|sure|ok|yeah|yah|ye)|\by[esahp]{2,}\b|\bs[ure]{2,}\b)/i),
	endDay: new RegExp(/(\be[end ]{2,}\bd[day]{2,})/i),
	containsNew: new RegExp(/(\bn[new]{2,}\b)/i),
	containsCheckin: new RegExp(/(\bch[check in]{3,}\b|r[reminder]{4,})/i),
	containsChangeTask: new RegExp(/(ch[change ]{3,}t[task ]{2,})/i),
	containsChangeTime: new RegExp(/(ch[change ]{3,}t[time ]{2,})/i),
	containsAddNote: new RegExp(/(a[add ]{1,}n[note ]{2,})/i),
	containsBreak: new RegExp(/(\bbr[reak ]{2,}\b)/i),
	containsBackLater: new RegExp(/(b[back ]{2,}l[later ]{2,})/i),
	startSession: new RegExp(/((s[start ]{2,}|n[new ]{2,}|w[work ]{2,})|s[session]{2,})/i),
	containsEnd: new RegExp(/(e[end]{2,})/i),
	containsNone: new RegExp(/((no|none|didnt|didn't)|\bn[otahpe]+\b)/i),
	containsDifferent: new RegExp(/((\bdi[different]{4,}\b)|(\b[else ]{3,}\b))/i),
	containsNumber: new RegExp(/\d/i),
	containsAll: new RegExp(/\ba[all]{2,}/i),
	containsAdd: new RegExp(/\ba[add]{1,}/i),
	startsWithAdd: new RegExp(/^a[add]{2,}\b/i),
	containsTask: new RegExp(/t[task]{2,}/i),
	containsName: new RegExp(/n[name]{2,}/i),
	containsTimeZone: new RegExp(/t[timezone ]{4,}/i),
	containsPlan: new RegExp(/p[plan ]{2,}/i),
	containsAdditional: new RegExp(/\ba[additional]{4,}/i),
	containsSnooze: new RegExp(/(\bs[snooze]{4,}|\be[extend]{4,})/i),
	onlyContainsSnooze: new RegExp(/^s[snooze]{4,}$/i),
	onlyContainsExtend: new RegExp(/^e[extend]{4,}$/i),
	containsElse: new RegExp(/\be[else]{2,}/i),
	containsShowCommands: new RegExp(/(\bs[show]{2,}|\bc[commands]{4,})/i),
	containsStartDay: new RegExp(/(\bs[start]{3,}|\bd[day]{2,})/i),
	containsSettings: new RegExp(/\bs[settings]{4,}/i),
	containsEditTaskList: new RegExp(/(\be[edit ]{2,}(\bl[list]{2,}|\bt[task]{2,}))/i),
	containsCompleteOrCheckOrCross: new RegExp(/(\bc[complete]{5,}|\bc[check]{3,}|\bc[cross]{3,})/i),
	containsDeleteOrRemove: new RegExp(/(\bd[delete]{4,}|\br[remove]{3,})/i),
	containsTime: new RegExp(/(\bt[time]{2,})/i),
	containsCancel: new RegExp(/(\bc[cancel]{4,})/i),
	containsContinue: new RegExp(/(\bc[continue]{5,})/i)
};
//# sourceMappingURL=botResponses.js.map