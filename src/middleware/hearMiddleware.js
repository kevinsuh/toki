import { controller } from '../index';

export function numberLessThanTen(patterns, message) {
	console.log("in number less than ten middleware");
	console.log("patterns:")
	console.log(patterns);
	console.log("\n\n\n");
	console.log("message:");
	console.log(message);

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
	console.log("in number greater than ten middleware");
	console.log("patterns:")
	console.log(patterns);
	console.log("\n\n\n");
	console.log("message:");
	console.log(message);

	var number = parseInt(message.text);
	if (number) {
		if (number > 10) {
			return true;
		}
	} else {
		return false;
	}
}