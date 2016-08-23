import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import moment from 'moment-timezone';

// base controller for "buttons" flow
export default function(controller) {

	// receive an interactive message via button click
	// check message.actions and message.callback_id to see the action to take
	controller.on(`interactive_message_callback`, (bot, message) => {

		const SlackUserId = message.user;
		const { actions, callback_id } = message;
		let payload;
		let config;

		// need to replace buttons so user cannot reclick it
		if (actions && actions.length > 0) {
			switch (actions[0].value) {
				default: break;
			}
		}

	})


};