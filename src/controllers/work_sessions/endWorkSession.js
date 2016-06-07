import os from 'os';
import { wit } from '../../index';
import moment from 'moment-timezone';
import { randomInt } from '../../lib/botResponses';

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
	});

	
}

function askForBreak(response, convo) {
	convo.say("Excellent!");
	convo.ask("Would you like to take a 15 minute break now before jumping in to your next focused session?", (response, convo) => {
		convo.say("Sounds good");
		convo.next();
	});
}
