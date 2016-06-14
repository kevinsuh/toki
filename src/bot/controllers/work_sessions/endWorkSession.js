import os from 'os';
import { wit } from '../index';
import moment from 'moment-timezone';
import { randomInt } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

import models from '../../../app/models';

// END OF A WORK SESSION
export default function(controller) {

	/**
	 * 		ENDING WORK SESSION:
	 * 			1) Explict command to finish session early
	 * 			2) Your timer has run out
	 */

	// User wants to finish session early (wit intent)
	controller.hears(['done_session'], 'direct_message', wit.hears, (bot, message) => {

		/**
		 * 			check if user has open session (should only be one)
		 * 					if yes, trigger finish and end_session flow
		 * 			  	if no, reply with confusion & other options
		 */
		
		const SlackUserId = message.user;

		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [
				models.SlackUser
			]
		})
		.then((user) => {
			return user.getWorkSessions({
				where: [ `"open" = ?`, true ]
			});
		})
		.then((workSessions) => {
			if (workSessions.length > 0) {
				// has open work sessions
				bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
					convo.ask(`Are you finished with your session?`, [
						{
							pattern: bot.utterances.yes,
							callback: (response, convo) => {
								convo.finishedWithSession = true;
								convo.next();
							}
						},
						{
							pattern: bot.utterances.no,
							callback: (response, convo) => {
								convo.say(`Oh, never mind then! Keep up the work :weight_lifter:`);
								convo.next();
							}
						}
					]);
					convo.on('end', (convo) => {
						if (convo.finishedWithSession) {
							controller.trigger('end_session', [bot, { SlackUserId }]);
						}
					});
				})
			} else {
				// no open sessions
				bot.send({
					type: "typing",
					channel: message.channel
				});
				setTimeout(()=>{
					bot.reply(message, "You don't have any open sessions right now :thinking_face:. Let me know when you want to `start a session`");
				}, randomInt(1250, 1750));
			}
		});
	});

	// session timer is up
	controller.on('session_timer_up', (bot, config) => {

		/**
		 * 		Timer is up. Give user option to extend session or start reflection
		 */

		const { SlackUserId } = config;

		// has open work sessions
		bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
			convo.ask(`:timer_clock: time's up. Reply \`done\` when you're ready to end the session`, (response, convo) => {

				var responseMessage = response.text;
				var { intentObject: { entities } } = response;
				var done = new RegExp(/[d]/);

				if (entities.duration || entities.custom_time) {
					convo.say("Got it, you want more time :D");
					// addSnoozeToSession(response, convo)
				} else if (done.test(responseMessage)) {
					convo.finishedWithSession = true;
				} else {
					// invalid
					convo.say("I'm sorry, I didn't catch that :dog:");
					convo.repeat();
				}

				convo.next();

			});
			convo.on('end', (convo) => {
				if (convo.finishedWithSession) {
					controller.trigger('end_session', [bot, { SlackUserId }]);
				}
			});
		})

	});

	// the actual end_session flow
	controller.on('end_session', (bot, config) => {

		/**
		 * 		User has agreed for session to end at this point
		 */

		const { SlackUserId } = config;

		bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

			convo.say("Hey! congrats on finishing your session!");

		});

	});

};



		// when done with session
		// 1. Great work {name}!
		// 2. What would you like to remember about this session? This could be something specific about what you got done, or more general notes about how you felt
		// 3. Awesome :) Which tasks did you complete? I'll update your list
		// 4. show task list
		// 5. get numbers to then cross out task list. CROSS TASK LIST BY EDITING MESSAGE
		// 6. Lastly, how did that session feel? (put the 4 emojis)
		// 7. Would you like to take a break? Or just respond to what user says
		

		// this clears the timeout that you set
	// 	clearTimeout(bot.timer);
		

	// 	bot.api.reactions.add({
	// 		timestamp: message.ts,
	// 		channel: message.channel,
	// 		name: 'star',
	// 	}, (err, res) => {
	// 		console.log("added reaction!");
	// 		console.log(res);
	// 		if (err) {
	// 			bot.botkit.log('Failed to add emoji reaction :(', err);
	// 		}
	// 	});

	// 	bot.send({
 //        type: "typing",
 //        channel: message.channel
 //    });
 //    setTimeout(()=>{
 //    	bot.startConversation(message, askForReflection);
 //    }, randomInt(1000, 1750));

	// });


/**
 * 		CONVERSATION QUESTIONS
 * 		these are callback functions that take 2 params
 * 		1) response (that specific response)
 * 		2) convo (object of entire convo)
 */

function askForReflection(response, convo) {
	console.log("asking for reflection");

	const { task }                = convo;
	const { bot, source_message } = task;

	convo.say("Excellent work!! :sports_medal:");

	convo.ask("What would you like to remember about this session? This could be something specific about what you got done, or more general notes about how you felt", (response, convo) => {

		// reward the reflection!
		const { task: { bot, convos } }     = convo;
		const { responses: { reflection } } = convos[0];
		
		bot.api.reactions.add({
			timestamp: reflection.ts,
			channel: reflection.channel,
			name: '100',
		}, (err, res) => {
			console.log("added reaction!");
			console.log(res);
			if (err) {
				bot.botkit.log('Failed to add emoji reaction :(', err);
			}
		});
		
		askForTaskUpdate(response, convo);
		convo.next();

	}, { 'key' : 'reflection' });

	convo.on('end', finishReflection);

}

function askForTaskUpdate(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	bot.send({
		type: "typing",
		channel: source_message.channel
	});

	convo.say("Awesome stuff!! Great to hear :smiley:");
	convo.ask("Which tasks did you complete? I’ll update your list :pencil: (i.e `1, 5, 4`)", (response, convo) => {
		askForBreak(response, convo);
		convo.next();
	}, { 'key': 'tasksDone' });
	
}

function askForBreak(response, convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	convo.say("Excellent!");
	convo.ask("Would you like to take a 15 minute break now before jumping in to your next focused session?", [
			{
				pattern: bot.utterances.yes,
				callback: (response, convo) => {
					convo.say("Sounds great! I'll ping you in 15 minutes :timer_clock:");
			  	convo.next();
				}
			},
			{
				pattern: bot.utterances.no,
				callback: (response, convo) => {
				  convo.say("Sounds good. I'll be here when you're ready to jump back in :swimmer:");
				  convo.next();
				}
			},
			{
				default: true,
				callback: function(response, convo) {
					convo.say("Sorry, I didn't get that :dog:");
				  convo.repeat();
				  convo.next();
				}
			}
	], { 'key' : 'wantsBreak' });
}

function finishReflection(convo) {

	const { task }                = convo;
	const { bot, source_message } = task;

	if (convo.status == 'completed') {

		// all of user responses in object
		var res = convo.extractResponses();

		var reflection = convo.extractResponse('reflection');
		convo.say(`Nice. Your reflection was: ${reflection}`);

		console.log("FINISH REFLECTION");
		console.log(bot);
		console.log(JSON.stringify(bot.storage));
		console.log('\n\n\n\n\n\n\n\n\n\n\n');
		console.log(convo);

	} else {
		// this happens if the conversation ended prematurely for some reason
		convo.say(message, 'Okay, nevermind then!');
	}
}
