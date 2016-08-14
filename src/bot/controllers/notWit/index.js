import os from 'os';
import { wit, bots } from '../index';
import moment from 'moment-timezone';

import models from '../../../app/models';
import { utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues } from '../../lib/constants';
import { witTimeResponseToTimeZoneObject, witDurationToTimeZoneObject, dateStringToMomentTimeZone } from '../../lib/miscHelpers';
import { convertTimeStringToMinutes } from '../../lib/messageHelpers';

import { resumeQueuedReachouts } from '../index';

import dotenv from 'dotenv';

/**
 * 		Sometimes there is a need for just NL functionality not related
 * 		to Wit and Wit intents. Put those instances here, since they will
 * 		show up before Wit gets a chance to pick them up first.
 */

export default function(controller) {

	// TOKI_T1ME TESTER
	controller.hears(['TOKI_T1ME'], 'direct_message', (bot, message) => {

		const { text } = message;
		const SlackUserId = message.user;

		bot.send({
			type: "typing",
			channel: message.channel
		});
		setTimeout(()=>{

			let HEY_LISTEN = new RegExp(/\bHEY_LISTEN\b/);
			let GYRADOS    = new RegExp(/\bGYRADOS\b/);

			if (HEY_LISTEN.test(text)) {
				if (GYRADOS.test(text)) {
					controller.trigger(`gyrados_message_flow`, [ bot, { SlackUserId } ]);
				} else {
					controller.trigger(`global_message_flow`, [ bot, { SlackUserId } ]);
				}
			} else {
				controller.trigger(`begin_onboard_flow`, [ bot, { SlackUserId } ]);
			}
		}, 1000);

	});

	// intentionally pausing session
	controller.hears(['pa[ause]{1,}'], 'direct_message', (bot, message) => {

		const SlackUserId = message.user;

		const { text, intentObject: { entities: { reminder, datetime, duration } } } = message;

		var valid = true;

		// these are different scenarios where a pause NL functionality is highly unlikely
		if (datetime || duration) {
			valid = false;
		} else if (text.length > 25) {
			valid = false;
		} else if (text[0] == "/") {
			valid = false;
		}

		if (valid) {
			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(()=>{

				let config = { SlackUserId };
				bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
					convo.say("Okay, let's pause!");
					convo.next();
					convo.on('end', (convo) => {
						controller.trigger(`session_pause_flow`, [bot, config]);
					});
				});

			}, 1000);
		}

	});

	// intentionally resuming session
	controller.hears(['re[esume]{3,}'], 'direct_message', (bot, message) => {

		const SlackUserId = message.user;

		const { text, intentObject: { entities: { reminder, datetime, duration } } } = message;

		var valid = true;

		// these are different scenarios where a pause NL functionality is highly unlikely
		if (datetime || duration) {
			valid = false;
		} else if (text.length > 25) {
			valid = false;
		} else if (text[0] == "/") {
			valid = false;
		}

		if (valid) {
			bot.send({
				type: "typing",
				channel: message.channel
			});
			setTimeout(()=>{

				let config = { SlackUserId };
				bot.startPrivateConversation( { user: SlackUserId }, (err, convo) => {
					convo.say("Okay, let's resume :arrow_forward:");
					convo.next();
					convo.on('end', (convo) => {
						controller.trigger(`session_resume_flow`, [bot, config]);
					});
				});

			}, 1000);
		}

	});

	controller.on('global_message_flow', (bot, config) => {

		const { SlackUserId } = config;

		// IncluderSlackUserId is the one who's actually using Toki
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [ models.SlackUser ]
		}).then((user) => {

			const UserId       = user.id;
			const { email, nickName, SlackUser: { tz } } = user;
			const adminEmails = [`kevinsuh34@gmail.com`, `chipkoziara@gmail.com`, `kevin_suh34@yahoo.com`, `ch.ipkoziara@gmail.com`];

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				convo.globalMessage = {
					text: false
				}

				if (adminEmails.indexOf(email) > -1) {
					askWhichMessageToSend(convo);
				} else {
					convo.say(`You are not authorized to send a global message :rage:`);
				}

				convo.on(`end`, (convo) => {
					
					const { globalMessage } = convo;

					if (globalMessage.text) {

						sendGlobalMessage(globalMessage.text);

					}

				});

			});
		});
	});

	// THIS IS THE MESSAGE OVERWRITING EVERYONE ONTO THE NEW FLOW
	controller.on('gyrados_message_flow', (bot, config) => {

		const { SlackUserId } = config;

		// IncluderSlackUserId is the one who's actually using Toki
		models.User.find({
			where: [`"SlackUser"."SlackUserId" = ?`, SlackUserId ],
			include: [ models.SlackUser ]
		}).then((user) => {

			const UserId       = user.id;
			const { email, nickName, SlackUser: { tz } } = user;
			const adminEmails = [`kevinsuh34@gmail.com`, `chipkoziara@gmail.com`, `kevin_suh34@yahoo.com`, `ch.ipkoziara@gmail.com`];

			bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {

				convo.globalMessage = {
					text: false
				}

				if (adminEmails.indexOf(email) > -1) {
					confirmGyradosMessage(convo);
				} else {
					convo.say(`You are not authorized to send this gyrados message message :rage:`);
				}

				convo.on(`end`, (convo) => {
					
					const { confirmSendGyradosMessage } = convo;

					if (confirmSendGyradosMessage) {

						sendGyradosMessage(controller);

					}

				});

			});
		});
	});

}

function askWhichMessageToSend(convo) {

	convo.say(`Welcome to *_hey listen_*! The message you send here will get sent to every user who I have in my database, through me. Please don't make me look bad :wink:`);
	convo.ask(`What is the message you want to send?`, [
		{
			pattern: utterances.noAndNeverMind,
			callback: (response, convo) => {
				convo.say(`Got it! Exiting now. :wave:`);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				confirmMessageToSend(response, convo);
				convo.next();
			}
		}
	]);

}

function confirmMessageToSend(response, convo) {
	const { text } = response;
	convo.say(text);
	convo.ask(`Is that the message you want to send above?`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.globalMessage.text = text;
				convo.say(`Got it! Sending now. . . . :robot_face: `);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay! If you want to exit, say `never mind`");
				askWhichMessageToSend(convo)
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say("Sorry, I didn't catch that");
				convo.repeat();
				convo.next();
			}
		}
	]);
}

function confirmGyradosMessage(convo) {

	convo.say(`Good morning! I've received an update that changes the way I work with you\nNow I help you *define and accomplish the 3 most important outcomes each day*`);
	convo.say(`This is a big change, but as Benjamin Franklin said:\n> _"Without continual growth and progress, such words as improvement, achievement, and success have no meaning.”_​`);
	convo.say({
		text: `Thank you for being an early user :heart_eyes: I’m excited to help you win your day :muscle:`,
		attachments: [
			{
				attachment_type: 'default',
				callback_id: "CONFIRM_NEW_TOKI",
				fallback: "Ready to start our new adventure?",
				color: colorsHash.green.hex,
				actions: [
					{
							name: buttonValues.letsWinTheDay.name,
							text: ":running:Begin adventure:running:",
							value: buttonValues.letsWinTheDay.value,
							type: "button"
					}
				]
			}
		]
	});

	convo.ask(`Is that the message you want to send above?`, [
		{
			pattern: utterances.yes,
			callback: (response, convo) => {
				convo.confirmSendGyradosMessage = true;
				convo.say(`Got it! Sending now. . . . :robot_face: `);
				convo.next();
			}
		},
		{
			pattern: utterances.no,
			callback: (response, convo) => {
				convo.say("Okay! Exiting out of gyrados flow now");
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say("Sorry, I didn't catch that");
				convo.repeat();
				convo.next();
			}
		}
	]);
	convo.next();

}

function sendGyradosMessage(controller) {

	let env = process.env.NODE_ENV || 'development';
	if (env == 'development') {
		console.log("In development server of Toki");
	  process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
	} else {
		console.log(`currently in ${env} environment`);
	}

	for (let token in bots) {

		const bot    = bots[token];
		const TeamId = bot.team_info.id;

		models.User.findAll({
			where: [`"SlackUser"."TeamId" = ?`, TeamId ],
			include: [ models.SlackUser ]
		}).then((users) => {

			users.forEach((user) => {

				const { email, SlackUser: { SlackUserId } } = user;

				console.log(email);

				const testEmails = [`kevinsuh3444@gmail.com`, `kevinsuh34@gmail.com`, `chip.koziara@gmail.com`, `chipkoziara@gmail.com`, `kjs2146@columbia.edu` ]
				if (testEmails.indexOf(email) > -1) {
					// HOLD IN VACUUM FOR NOW
					bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
						if (!err) {

							convo.say(`Good morning! I've received an update that changes the way I work with you\nNow I help you *define and accomplish the 3 most important outcomes each day*`);
							convo.say(`This is a big change, but as Benjamin Franklin said:\n> _"Without continual growth and progress, such words as improvement, achievement, and success have no meaning.”_​`);
							convo.ask({
								text: `Thank you for being an early user :heart_eyes: I’m excited to help you win your day :muscle:`,
								attachments: [
									{
										attachment_type: 'default',
										callback_id: "CONFIRM_NEW_TOKI",
										fallback: "Ready to start our new adventure?",
										color: colorsHash.green.hex,
										actions: [
											{
													name: "BEGIN_ADVENTURE",
													text: ":running:Begin adventure:running:",
													value: "begin adventure",
													type: "button"
											}
										]
									}
								]
							}, [
								{
									pattern: utterances.beginAdventure,
									callback: (response, convo) => {
										convo.confirmBeginAdventure = true;
										convo.say(`*_Here... we... go!!!_* :rocket:`)
										convo.next();
									}
								},
								{
									default: true,
									callback: (response, convo) => {
										convo.say("Sorry, I didn't catch that!");
										convo.repeat();
										convo.next();
									}
								}
							]);
							
							convo.on('end', (convo) => {
								const { confirmBeginAdventure } = convo;
								if (confirmBeginAdventure) {
									controller.trigger(`begin_onboard_flow`, [ bot, { SlackUserId }]);
								}
							})
						}
						
					});
				}

			})

		});

	}
}

// sends message to all of the users in our DB!
function sendGlobalMessage(text) {

	let env = process.env.NODE_ENV || 'development';
	if (env == 'development') {
		console.log("In development server of Toki");
	  process.env.BOT_TOKEN = process.env.DEV_BOT_TOKEN;
	} else {
		console.log(`currently in ${env} environment`);
	}

	for (let token in bots) {

		const bot    = bots[token];
		const TeamId = bot.team_info.id;

		models.User.findAll({
			where: [`"SlackUser"."TeamId" = ?`, TeamId ],
			include: [ models.SlackUser ]
		}).then((users) => {

			users.forEach((user) => {

				const { email, SlackUser: { SlackUserId } } = user;
				console.log(email);
				bot.startPrivateConversation({ user: SlackUserId }, (err, convo) => {
					if (!err) {
						// some users are disabled and this will not send to them
						convo.say(text);
					}
				});

			})

		});

	}

}

