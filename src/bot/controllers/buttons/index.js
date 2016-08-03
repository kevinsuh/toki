import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';
import { buttonValues, constants } from '../../lib/constants';
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
				case buttonValues.doneSessionTimeoutYes.value:
					controller.trigger(`done_session_yes_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.doneSessionTimeoutSnooze.value:
					models.User.find({
						where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
						include: [
							models.SlackUser
						]
					})
					.then((user) => {
						controller.trigger(`done_session_snooze_button_flow`, [ bot, { SlackUserId, botCallback: true }]);
					});
					break;
				case buttonValues.doneSessionTimeoutDidSomethingElse.value:
					controller.trigger(`end_session`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.doneSessionTimeoutNo.value:
					controller.trigger(`done_session_no_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.startSession.pause.value:
					controller.trigger(`session_pause_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.startSession.addCheckIn.value:
					controller.trigger(`session_add_checkin_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.startSession.endEarly.value:
					controller.trigger(`session_end_early_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.startSession.pause.endEarly.value:
					controller.trigger(`session_end_early_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				case buttonValues.startSession.resume.value:
					controller.trigger(`session_resume_flow`, [ bot, { SlackUserId, botCallback: true }]);
					break;
				default: break;
			}
		}

	})


};