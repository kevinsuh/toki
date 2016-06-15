import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';

import endWorkSessionController from './endWorkSession';
import middleWorkSessionController from './middleWorkSession';
import startWorKSessionController from './startWorKSession';

// base controller for work sessions
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startWorKSessionController(controller);
	middleWorkSessionController(controller);
	endWorkSessionController(controller);

	/**
	 * 		FLOW for when User is back and ready to go
	 */
	controller.hears(['is_back'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(() => {
			// find user then reply
			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId],
				include: [ models.SlackUser ]
			})
			.then((user) => {
				bot.startConversation(message, (err, convo) => {

					convo.isBack = {
						SlackUserId,
						isBackDecision: false // what user wants to do
					}

					var name = user.nickName || user.email;

					convo.say(`Welcome back, ${name}!`);
					convo.ask(`I can help you start another session or end the day :grin:`, (response, convo) => {
						// should eventually contain logic for 5 hour start_day vs start_session
						var { intentObject: { entities } } = response;
						var { intent }                     = entities;
						var intentValue                    = (intent && intent[0]) ? intent[0].value : null;

						// if (intentValue) {
						// 	switch(intentValue) {
						// 		case 
						// 	}
						// }

					});
				})
			});
		}, 1000);
		

	});

};