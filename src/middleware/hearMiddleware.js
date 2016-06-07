// all middleware for hear events
// when using wit middleware, you will get `message.intents`
// which are the returned intents from wit's service of the incoming natural language input

// patterns is the array of strings that your controller is listening to
// message is the specific message sent (object): the actual text is message.text


export function numberLessThanTen(patterns, message) {

	var number = parseInt(message.text);
	if (number) {
		if (number < 10) {
			return true;
		}
	} else {
		return false;
	}
}


export function numberGreaterThanTen(patterns, message) {

	var number = parseInt(message.text);
	if (number) {
		if (number > 10) {
			return true;
		}
	} else {
		return false;
	}
}