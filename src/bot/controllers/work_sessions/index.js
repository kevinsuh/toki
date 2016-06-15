import os from 'os';
import { wit } from '../index';

import models from '../../../app/models';

import endWorkSessionController from './endWorkSession';
import middleWorkSessionController from './middleWorkSession';
import startWorKSessionController from './startWorKSession';

import intentConfig from '../../lib/intents';

// base controller for work sessions
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	startWorKSessionController(controller);
	middleWorkSessionController(controller);
	endWorkSessionController(controller);

	/**
	 * 		IS_BACK ("READY TO WORK" - Peon WCIII)
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

						if (intentValue) {
							switch(intentValue) {
								case intentConfig.START_SESSION:
									convo.isBackDecision = intentConfig.START_SESSION;
									convo.say(`Let's do this :thumbsup:`);
									break;
								case intentConfig.END_DAY:
									convo.isBackDecision = intentConfig.END_DAY;
									convo.say(`Let's review the day! :pencil:`);
									break;
								default:
									convo.say(`Totally cool, just let me know when you're ready to do either of those things! :wave:`);
									break;
							}
						}
						convo.next();

					});
					convo.on(`end`, (convo) => {
						const { isBackDecision } = convo;
						if (convo.status == 'completed') {
							switch (isBackDecision) {
								case intentConfig.START_SESSION:
									console.log("\n\n\nSTART_SESSION!\n\n\n");
									break;
								case intentConfig.END_DAY:
									console.log("\n\n\nEND_DAY\n\n\n");
									break;
								default:
									break;
							}
						} else {
							bot.reply(message, "Okay! Let me know when you want to start a session or day");
						}
					});
				});
			});
		}, 1000);
		

	});

};