import { wit, bots } from '../controllers/index';
import models from '../../app/models';

export function isJsonObject(patterns, message) {

	const { text } = message;
	try {
		JSON.parse(text);
		return true;
	}
	catch (error) {
		return false;
	}
}

