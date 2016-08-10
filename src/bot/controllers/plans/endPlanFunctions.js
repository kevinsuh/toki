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
		convo.say(`Here's what you got done:\n${completedTaskListMessage}`);
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
	
	const { dayEnd: { wonDay, nickName } } = convo;

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
				convo.say(`I hope you have a great rest of the day and I’ll see you soon!`);
				convo.next();
			}
		},
		{
			default: true,
			callback: (response, convo) => {
				convo.say(`Thank you for sharing!`);
				convo.say(`I hope you have a great rest of the day and I’ll see you soon!`);
				convo.dayEnd.reflection = response.text;
				convo.next();
			}
		}
	]);

}
