import os from 'os';
import { numberLessThanTen, numberGreaterThanTen } from '../middleware/hearMiddleware';
import { helloResponse, randomInt } from '../lib/botResponses';
import { wit } from './index';

// MISC functionalities
// easter eggs, fun things, non-important (like saying hello)
export default function(controller) {

	// TEST
	controller.on('test_message_send', (bot, userID, message) => {

	  bot.startPrivateConversation({user: userID}, (err, convo) => {
	    convo.say(message);
	  });

	});

	controller.on('user_typing', (bot, message) => {
		console.log("user is typing!");
	});

	controller.hears(['^(kevin)$', '^(kev[in]*)$'], 'direct_message', (bot, message) => {

		bot.api.reactions.add({
			timestamp: message.ts,
			channel: message.channel,
			name: 'heart',
		}, (err, res) => {
			console.log("added reaction!");
			console.log(res);
			if (err) {
				bot.botkit.log('Failed to add emoji reaction :(', err);
			}
		})

	});

	// messing around w/ custom hear middleware
	controller.hears(controller.utterances.hears.number, 'direct_message', numberLessThanTen, (bot, message) => {
			bot.reply(message, "That is a number less than 10!");
	});
	controller.hears(controller.utterances.hears.number, 'direct_message', numberGreaterThanTen, (bot, message) => {
			bot.reply(message, "That is a number greater than 10!");
	});

	controller.hears(["^chip$"], 'direct_message', (bot, message) => {

		bot.api.reactions.add({
			timestamp: message.ts,
			channel: message.channel,
			name: 'cookie',
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
    	bot.reply(message, "Chip, as in... Chocolate chip?");
    }, randomInt(500, 1500));

	});

	controller.hears(controller.utterances.hears.hello, 'direct_message', function (bot, message) {

		bot.api.reactions.add({
			timestamp: message.ts,
			channel: message.channel,
			name: 'wave'
		}, function (err, res) {
			if (err) {
				bot.botkit.log('Failed to add emoji reaction :(', err);
			}
		});

		controller.storage.users.get(message.user, function (err, user) {
			if (user && user.name) {
				bot.reply(message, 'Hello ' + user.name + '!!');
			} else {
				var response = helloResponse();
				bot.send({
        	type: "typing",
        	channel: message.channel
		    });
		    setTimeout(()=>{
		    	bot.reply(message, response);
		    }, randomInt(500, 1500));
			}
		});
	});

	/**
	 * 		BOTKIT EXAMPLE CODE
	 */

	controller.hears(["let's start a (.*) conversation about (.*)"], ["direct_message"], (bot, message) => {
		var adjective = message.match[1];
		var topic = message.match[2];
		bot.startConversation(message, (err, convo) => {
			convo.say(`You want a ${adjective} type of conversation`);
			convo.say(`And you want to talk about ${topic}!`);
		})
	});

	controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
	    var name = message.match[1];
	    controller.storage.users.get(message.user, function(err, user) {
	        if (!user) {
	            user = {
	                id: message.user,
	            };
	        }
	        user.name = name;
	        controller.storage.users.save(user, function(err, id) {
	            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
	        });
	    });
	});

	controller.hears(['what is my name', 'who am i'], 'direct_message', function(bot, message) {

	    controller.storage.users.get(message.user, function(err, user) {
	        if (user && user.name) {
	            bot.reply(message, 'Your name is ' + user.name);
	        } else {
	            bot.startConversation(message, function(err, convo) {
	                if (!err) {
	                    convo.say('I do not know your name yet!');
	                    convo.ask('What should I call you?', function(response, convo) {
	                    	console.log("inside of first question CB");
	                    	console.log(convo);
	                        convo.ask('You want me to call you `' + response.text + '`?', [
	                            {
	                                pattern: 'yes',
	                                callback: function(response, convo) {
	                                    // since no further messages are queued after this,
	                                    // the conversation will end naturally with status == 'completed'
	                                    console.log(`inside of second question CB that you answered yes to: ${response.text}`);
	                                    console.log(response);
	                                    console.log(convo);
	                                    convo.next();
	                                }
	                            },
	                            {
	                                pattern: 'no',
	                                callback: function(response, convo) {
	                                    // stop the conversation. this will cause it to end with status == 'stopped'
	                                    convo.stop();
	                                }
	                            },
	                            {
	                                default: true,
	                                callback: function(response, convo) {
	                                    convo.repeat();
	                                    convo.next();
	                                }
	                            }
	                        ]);

	                        convo.next();

	                    }, {'key': 'nickname'}); // store the results in a field called nickname

	                    convo.on('end', function(convo) {
	                    	console.log("convo is done...");
	                    	console.log(convo);
	                        if (convo.status == 'completed') {
	                            bot.reply(message, 'OK! I will update my dossier...');

	                            controller.storage.users.get(message.user, function(err, user) {
	                                if (!user) {
	                                    user = {
	                                        id: message.user,
	                                    };
	                                }
	                                var responses = convo.extractResponses(); // returns the JS object of key:values. If you don't specify, the key will be string of your question. the value is an object with text property being the user's response
	                                console.log("This convo's responses are:");
	                                console.log(responses);
	                                user.name = convo.extractResponse('nickname');
	                                controller.storage.users.save(user, function(err, id) {
	                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
	                                });
	                            });



	                        } else {
	                            // this happens if the conversation ended prematurely for some reason
	                            bot.reply(message, 'OK, nevermind!');
	                        }
	                    });
	                }
	            });
	        }
	    });
	});


	controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

	    bot.startConversation(message, function(err, convo) {

	        convo.ask('Are you sure you want me to shutdown?', [
	            {
	                pattern: bot.utterances.yes,
	                callback: function(response, convo) {
	                    convo.say('Bye!');
	                    convo.next();
	                    setTimeout(function() {
	                        process.exit();
	                    }, 3000);
	                }
	            },
	        {
	            pattern: bot.utterances.no,
	            default: true,
	            callback: function(response, convo) {
	                convo.say('*Phew!*');
	                convo.next();
	            }
	        }
	        ]);
	    });
	});


	controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
	    'direct_message,direct_mention,mention', function(bot, message) {

	        var hostname = os.hostname();
	        var uptime = formatUptime(process.uptime());

	        bot.reply(message,
	            ':robot_face: I am a bot named <@' + bot.identity.name +
	             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

	    });

	function formatUptime(uptime) {
	    var unit = 'second';
	    if (uptime > 60) {
	        uptime = uptime / 60;
	        unit = 'minute';
	    }
	    if (uptime > 60) {
	        uptime = uptime / 60;
	        unit = 'hour';
	    }
	    if (uptime != 1) {
	        unit = unit + 's';
	    }

	    uptime = uptime + ' ' + unit;
	    return uptime;
	}


};