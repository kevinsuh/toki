import os from 'os';
import { wit } from '../index';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

import { randomInt } from '../../lib/botResponses';
import { convertResponseObjectsToTaskArray, convertArrayToTaskListMessage, convertTimeStringToMinutes } from '../../lib/messageHelpers';
import intentConfig from '../../lib/intents';

export const FINISH_WORD = 'done';
export const EXIT_EARLY_WORDS = ['exit', 'stop','never mind','quit'];

// base controller for end day
export default function(controller) {

	// programmatic trigger of actual day start flow: `end_day_flow`
	controller.on('trigger_day_start', (bot, config) => {

		const { SlackUserId } = config;
		controller.trigger(`end_day_flow`, [ bot, { SlackUserId } ]);

	})

	/**
	 * 		User directly asks to end day
	 * 				~* via Wit *~
	 * 			confirm for `end_day_flow`
	 */
	controller.hears(['end_day'], 'direct_message', wit.hears, (bot, message) => {

		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{

			models.User.find({
				where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
				include: [
					models.SlackUser
				]
			})
			.then((user) => {

				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

					var name              = user.nickName || user.email;
					convo.name            = name;
					convo.readyToEndDay = false;

					convo.ask(`Hey ${name}! Would you like to end your day?`, [
						{
							pattern: bot.utterances.yes,
							callback: (response, convo) => {
								convo.readyToEndDay = true;
								convo.next();
							}
						},
						{
							pattern: bot.utterances.no,
							callback: (response, convo) => {
								convo.say("Okay. I'm here whenever you're ready to end your day :wave:");
								convo.next();
							}
						},
						{
							default: true,
							callback: (response, convo) => {
								convo.say("Couldn't quite catch that. I'll be here when you're ready to `end your day` :wave:");
								convo.next();
							}
						}
					]);
					convo.on('end', (convo) => {
						if (convo.readyToEndDay) {
							controller.trigger(`end_day_flow`, [ bot, { SlackUserId }]);
						}
					})
				
				});
			});
		}, 1000);
	});

	/**
	* 	~ ACTUAL END OF YOUR DAY ~
	* 		* Show completed tasks
	* 		* Show total time of focused sessions
	* 		* Ask for reflection
	* 		* 
	* 		
	*/
	controller.on('end_day_flow', (bot, config) => {

		const { SlackUserId } = config;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				var name   = user.nickName || user.email;
				convo.name = name;

				convo.dayEnd = {
					UserId: user.id,
					endDayDecision: false // what does user want to do with day
				}


    		// on finish conversation
    		convo.on('end', (convo) => {

  				var responses = convo.extractResponses();
  				const { dayEnd } = convo;

  				console.log('done!')
  				console.log("here is end day object:\n\n\n");
  				console.log(convo.dayEnd);
  				console.log("\n\n\n");

    			if (convo.status == 'completed') {

    			} else {
    				// default premature end
						bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
							convo.say("Okay! Exiting now. Let me know when you want to start your day!");
							convo.next();
						});
    			}
    		});

			});

		})

	});

};