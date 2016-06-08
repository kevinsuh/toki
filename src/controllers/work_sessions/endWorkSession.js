import os from 'os';
import { wit } from '../../index';
import moment from 'moment-timezone';
import { randomInt } from '../../lib/botResponses';
import http from 'http';
import bodyParser from 'body-parser';

// END OF A WORK SESSION
export default function(controller) {

	/**
	 * 		INDEX functions of work sessions
	 */
	
	/**
	 * 		FINISHING A WORK SESSION BY COMMAND
	 */
	
	// we are relying on wit to do all of the NL parsing for us
	// so that it normalizes into `intent` strings for us to decipher
	controller.hears(['done_session'], 'direct_message', wit.hears, (bot, message) => {

		// when done with session
		// 1. Great work {name}!
		// 2. What would you like to remember about this session? This could be something specific about what you got done, or more general notes about how you felt
		// 3. Awesome :) Which tasks did you complete? I'll update your list
		// 4. show task list
		// 5. get numbers to then cross out task list. CROSS TASK LIST BY EDITING MESSAGE
		// 6. Lastly, how did that session feel? (put the 4 emojis)
		// 7. Would you like to take a break? Or just respond to what user says
		

		// this clears the timeout that you set
		clearTimeout(bot.timer);
		

		bot.api.reactions.add({
			timestamp: message.ts,
			channel: message.channel,
			name: 'star',
		}, (err, res) => {
			console.log("added reaction!");
			console.log(res);
			if (err) {
				bot.botkit.log('Failed to add emoji reaction :(', err);
			}
		});

		bot.send({
        type: "typing",
        channel: message.channel
    });
    setTimeout(()=>{
    	bot.startConversation(message, askForReflection);
    }, randomInt(1000, 1750));

	});


};


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

	convo.on('end', onFinishReflection);

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

function onFinishReflection(convo) {
	if (convo.status == 'completed') {
		bot.reply(message, 'OK! I will update my dossier...');

		// controller.storage.users.get(message.user, function(err, user) {
		// 	if (!user) {
		// 		user = {
		// 			id: message.user,
		// 		};
		// 	}
		// 	user.name = convo.extractResponse('nickname');
		// 	controller.storage.users.save(user, function(err, id) {
		// 		bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
		// 	});
		// });

	} else {
		// this happens if the conversation ended prematurely for some reason
		bot.reply(message, 'Okay, nevermind then!');
	}
}
