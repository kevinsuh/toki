import os from 'os';
import { wit, resumeQueuedReachouts } from '../index';
import http from 'http';
import moment from 'moment';

import models from '../../../app/models';

import { randomInt, utterances } from '../../lib/botResponses';
import { colorsHash, buttonValues, constants } from '../../lib/constants';
import { convertArrayToTaskListMessage, convertTimeStringToMinutes, commaSeparateOutTaskArray,convertMinutesToHoursString, } from '../../lib/messageHelpers';

import { witTimeResponseToTimeZoneObject, witDurationToMinutes, mapTimeToTaskArray } from '../../lib/miscHelpers';

// this one shows the task list message and asks for options
export function startEndPlanConversation(convo) {

	const { dayEnd: { wonDay, wonDayStreak } } = convo;

	const { dayEnd: { dailyTasks } } = convo;

	let completedDailyTasks = [];
	let minutesWorked       = 0;
	dailyTasks.forEach((dailyTask) => {
		if (dailyTask.Task.done) {
			completedDailyTasks.push(dailyTask);
		}
		minutesWorked += dailyTask.dataValues.minutesSpent;
	});

	let timeWorkedString = convertMinutesToHoursString(minutesWorked);

	let options = { reviewVersion: true, calculateMinutes: true, noTitles: true };
	let completedTaskListMessage  = convertArrayToTaskListMessage(dailyTasks, options);

	if (wonDay) {
		convo.say(`:trophy: *Congratulations on winning the day!* :trophy:`);
		convo.say(`It's all about time well spent, and today you did just that`);
		if (completedDailyTasks.length > 0) {
			convo.say(`Here's what you got done:\n${completedTaskListMessage}`);
		}
			
		if (wonDayStreak > 1) {
			convo.say(`*You’ve won the day ​2 days in a row* :fire:`);
		}
	} else {
		let message = `We can do this together the next time!`;
		if (minutesWorked > 0) {
			message = `${message} You still spent *${timeWorkedString}* working toward your top priorities`;
		}
		convo.say(message);
	}

	askForReflection(convo);

}

function askForReflection(convo) {
	
	const { dayEnd: { wantsPing, pingTime, wonDay, nickName } } = convo;

	let message = '';
	if (wonDay) {
		message = `What was the biggest factor that helped you focus on your most important priorities?`
	} else {
		message = `What was the biggest factor that prevented you from focusing on your most important priorities?`;
	}

	convo.ask({
		text: message,
		attachments:[
			{
				attachment_type: 'default',
				callback_id: "END_PLAN_REFLECT",
				fallback: "Do you want to reflect about today?",
				color: colorsHash.grey.hex,
				actions: [
					{
							name: buttonValues.notToday.value,
							text: "Not today :grin:",
							value: buttonValues.notToday.value,
							type: "button"
					}
				]
			}
		]
	},[
		{
			pattern: utterances.notToday,
			callback: (response, convo) => {

				convo.say(`Got it!`);

				if (wantsPing && !pingTime) {
					askForPingTime(convo);
				} else {
					convo.say(`I hope you have a great rest of the day and I’ll see you soon!`);
				}

				convo.next();

			}
		},
		{
			default: true,
			callback: (response, convo) => {

				convo.say(`Thank you for sharing!`);
				convo.dayEnd.reflection = response.text;

				if (wantsPing && !pingTime) {
					askForPingTime(convo);
				} else {
					convo.say(`I hope you have a great rest of the day and I’ll see you soon!`);
				}

				convo.next();

			}
		}
	]);

}

function askForPingTime(convo) {

	const { dayEnd: { tz, wantsPing, pingTime, wonDay, nickName } } = convo;

	let text = '';
	if (wonDay) {
		text = `To help you keep winning your days like today, I can proactively reach out in the morning to help you plan your day. *What time would you like me to check in* with you each weekday morning?`
	} else {
		text = `To give you a better shot to win the day as soon as possible, I can proactively reach out in the morning to help you plan your day. *What time would you like me to check in* with you each weekday morning?`;
	}

	let attachments = [{
		attachment_type: 'default',
		callback_id: "PING_USER",
		fallback: "Do you want me to ping you in the morning?",
		color: colorsHash.grey.hex,
		actions: [
			{
				name: buttonValues.no.name,
				text: "No thanks",
				value: buttonValues.no.value,
				type: "button"
			},
		]
	}];

	convo.ask({
		text,
		attachments
	}, [
		{
			pattern: utterances.no,
			callback: function(response, convo) {

				convo.dayEnd.wantsPing = false;
				convo.say(`If you want me to reach out, just say \`show settings\` and set the time for your morning check-in. I hope you have a great rest of the day and I’ll see you soon!`);
				convo.next();

			}
		},
		{
			default: true,
			callback: function(response, convo) {

				let { text, intentObject: { entities: { duration, datetime } } } = response;
				let customTimeObject = witTimeResponseToTimeZoneObject(response, tz);
				let now = moment();

				if (!customTimeObject && !datetime) {

					convo.say("Sorry, I didn't get that :thinking_face: let me know a time like `8:30am`");
					convo.repeat();

				} else {

					// datetime success!
					convo.dayEnd.pingTime = customTimeObject;
					let timeString = customTimeObject.format("h:mm a");
					convo.say(`Great! I’ll reach out weekdays at ${timeString}. You can always change this by saying \`show settings\``);
					convo.say(`I hope you have a great rest of the day and I’ll see you soon!`);

				}

				convo.next();

			}
		}
	]);



}
