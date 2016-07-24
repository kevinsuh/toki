import moment from 'moment';

export const TOKI_DEFAULT_SNOOZE_TIME = 15;

export const TOKI_DEFAULT_BREAK_TIME = 10;

export const hoursForExpirationTime = 6;

export const MINUTES_FOR_DONE_SESSION_TIMEOUT = 30;

export const startDayExpirationTime = moment().subtract(hoursForExpirationTime, 'hours').format("YYYY-MM-DD HH:mm:ss Z");

export const FINISH_WORD = {
	word: "done",
	reg_exp: new RegExp(/^d[one]{2,}\b/i)
};

export const NONE = {
	word: "none",
	reg_exp: new RegExp(/^[none]{3,}e$/i)
};

export const RESET = {
	word: "reset",
	reg_exp: new RegExp(/^r[reset]{3,}\b/i)
}

export const THANK_YOU = {
	word: "thank you",
	reg_exp: new RegExp(/(^t(?=.*n)[thanks you]{4,}\b|^t(?=.*n)[thanksyou]{5,}\b|^t(?=.*x)[thx]{2,4}\b|^ty[y]{0,}\b)/i)
}

// contains an intent for duration and not datetime
export const DURATION_INTENT = {
	word: "duration",
	reg_exp: new RegExp((/((\b[\d]+( [hoursminutes]+\b|[hoursminutes]+\b))|([forin]{2,}[ ]?[\d]+\b)|(\bh[our]{2,}|\bm[inutes]{2,}))/i))
}

export const TIME_INTENT = {
	word: "time",
	reg_exp: new RegExp((/(:|[at]{2,}[ ]?[\d]+\b)/i))
}

export const EXIT_EARLY_WORDS = ['exit', 'stop','never mind','quit'];

export const colorsHash = {
	green: {
		hex: "#36a64f"
	},
	lightGreen: {
		hex: "#95B66C"
	},
	darkBlue: {
		hex: "#000057"
	},
	salmon: {
		hex: "#bb4444"
	},
	lightSalmon: {
		hex: "#F1D8DB"
	},
	lavendar: {
		hex: "#6e4474"
	},
	turquoise: {
		hex: "#44bbbb"
	},
	blue: {
		hex: "#3E589D"
	},
	orange: {
		hex: "#E99704"
	},
	grey: {
		hex: "#C1C1C3"
	},
	yellow: {
		hex: "#F0D003"
	}
};

var colorsArray = [];
for (var key in colorsHash) {
	colorsArray.push({
		title: key,
		hex: colorsHash[key].hex
	});
}
export { colorsArray };

export const buttonValues ={
	startNow: {
		name: "START_NOW",
		value: "START_NOW"
	},
	checkIn: {
		name: "CHECK_IN",
		value: "CHECK_IN"
	},
	changeTask: {
		name: "CHANGE_TASK",
		value: "CHANGE_TASK"
	},
	changeSessionTime: {
		name: "CHANGE_SESSION_TIME",
		value: "CHANGE_SESSION_TIME"
	},
	changeCheckinTime: {
		name: "CHANGE_CHECKIN_TIME",
		value: "CHANGE_CHECKIN_TIME"
	},
	addCheckinNote: {
		name: "ADD_CHECKIN_NOTE",
		value: "ADD_CHECKIN_NOTE"
	},
	startSession: {
		name: "START_SESSION",
		value: "START_SESSION",
		pause: {
			name: "START_SESSION_PAUSE",
			value: "START_SESSION_PAUSE"
		},
		addCheckIn: {
			name: "START_SESSION_ADD_CHECK_IN",
			value: "START_SESSION_ADD_CHECK_IN"
		},
		endEarly: {
			name: "START_SESSION_END_EARLY",
			value: "START_SESSION_END_EARLY"
		},
		resume: {
			name: "START_SESSION_RESUME",
			value: "START_SESSION_RESUME"
		}
	},
	newTask: {
		name: "NEW_TASK",
		value: "NEW_TASK"
	},
	takeBreak: {
		name: "TAKE_BREAK",
		value: "TAKE_BREAK"
	},
	endDay: {
		name: "END_DAY",
		value: "END_DAY"
	},
	backLater: {
		name: "BACK_LATER",
		value: "BACK_LATER"
	},
	noTasks: {
		name: "NO_TASKS",
		value: "NO_TASKS"
	},
	noPendingTasks:{
		name: "NO_PENDING_TASKS",
		value: "NO_PENDING_TASKS"
	},
	noAdditionalTasks:{
		name: "NO_ADDITIONAL_TASKS",
		value: "NO_ADDITIONAL_TASKS"
	},
	actuallyWantToAddATask: {
		name: "ACTUALLY_WANT_TO_ADD_TASK",
		value: "ACTUALLY_WANT_TO_ADD_TASK"
	},
	differentTask: {
		name: "DIFFERENT_TASK",
		value: "DIFFERENT_TASK"
	},
	keepName: {
		name: "KEEP_NAME",
		value: "KEEP_NAME"
	},
	differentName: {
		name: "DIFFERENT_NAME",
		value: "DIFFERENT_NAME"
	},
	timeZones: {
		eastern: {
			name: "EASTERN_TIME",
			value: "EASTERN_TIME"
		},
		central: {
			name: "CENTRAL_TIME",
			value: "CENTRAL_TIME"
		},
		mountain: {
			name: "MOUNTAIN_TIME",
			value: "MOUNTAIN_TIME"
		},
		pacific: {
			name: "PACIFIC_TIME",
			value: "PACIFIC_TIME"
		},
		other: {
			name: "OTHER_TIMEZONE",
			value: "OTHER_TIMEZONE"
		}
	},
	changeName: {
		name: "CHANGE_NAME",
		value: "CHANGE_NAME"
	},
	changeTimeZone: {
		name: "CHANGE_TIME_ZONE",
		value: "CHANGE_TIME_ZONE"
	},
	neverMind: {
		name: "NEVER_MIND",
		value: "NEVER_MIND"
	},
	startDay: {
		name: "START_DAY",
		value: "START_DAY"
	},
	createReminder: {
		name: "CREATE_REMINDER",
		value: "CREATE_REMINDER"
	},
	resetTimes: {
		name: "RESET_TIMES",
		value: "RESET_TIMES"
	},
	doneSessionTimeoutSnooze: {
		name: "DONE_SESSION_TIMEOUT_SNOOZE",
		value: "DONE_SESSION_TIMEOUT_SNOOZE"
	},
	doneSessionTimeoutYes: {
		name: "DONE_SESSION_TIMEOUT_YES",
		value: "DONE_SESSION_TIMEOUT_YES"
	},
	doneSessionTimeoutNo: {
		name: "DONE_SESSION_TIMEOUT_NO",
		value: "DONE_SESSION_TIMEOUT_NO"
	},
	doneSessionEarlyNo: {
		name: "DONE_SESSION_EARLY_NO",
		value: "DONE_SESSION_EARLY_NO"
	},
	doneSessionTimeoutDidSomethingElse: {
		name: "DONE_SESSION_TIMEOUT_DID_SOMETHING_ELSE",
		value: "DONE_SESSION_TIMEOUT_DID_SOMETHING_ELSE"
	},
	doneSessionSnooze: {
		name: "DONE_SESSION_SNOOZE",
		value: "DONE_SESSION_SNOOZE"
	},
	doneSessionYes: {
		name: "DONE_SESSION_YES",
		value: "DONE_SESSION_YES"
	},
	doneSessionNo: {
		name: "DONE_SESSION_NO",
		value: "DONE_SESSION_NO"
	},
	doneSessionDidSomethingElse: {
		name: "DONE_SESSION_DID_SOMETHING_ELSE",
		value: "DONE_SESSION_DID_SOMETHING_ELSE"
	},
	thatsCorrect: { 
		value: "THATS_CORRECT",
		name: "THATS_CORRECT"
	},
	thatsIncorrect: { 
		value: "THATS_INCORRECT",
		name: "THATS_INCORRECT"
	},
	addTask: {
		value: "ADD_TASK",
		name: "ADD_TASK"
	},
	changeTaskContent: {
		value: "CHANGE_TASK_CONTENT",
		name: "CHANGE_TASK_CONTENT"
	},
	changeTaskTime: {
		value: "CHANGE_TASK_TIME",
		name: "CHANGE_TASK_TIME"
	},
	editTaskList: {
		value: "EDIT_TASK_LIST",
		name: "EDIT_TASK_LIST"
	},
	addTasks: {
		value: "ADD_TASKS",
		name: "ADD_TASKS"
	},
	markComplete: {
		value: "MARK_TASK_COMPLETE",
		name: "MARK_TASK_COMPLETE"
	},
	deleteTasks: {
		value: "DELETE_TASKS",
		name: "DELETE_TASKS"
	},
	editTaskTimes: {
		value: "EDIT_TASK_TIMES",
		name: "EDIT_TASK_TIMES"
	},
	neverMindTasks: {
		value: "NEVER_MIND_TASKS",
		name: "NEVER_MIND_TASKS"
	},
	newSession: {
		value: "NEW_SESSION",
		name: "NEW_SESSION"
	},
	cancelSession: {
		value: "CANCEL_SESSION",
		name: "CANCEL_SESSION"
	},
	doneAddingTasks: {
		value: "DONE_ADDING_TASKS",
		name: "DONE_ADDING_TASKS"
	},
	endSessionYes: {
		value: "END_SESSION_YES",
		name: "END_SESSION_YES"
	},
	allPendingTasks: {
		value: "ALL_PENDING_TASKS",
		name: "ALL_PENDING_TASKS"
	},
	yes: {
		value: "YES",
		name: "YES"
	},
	remindMe: {
		value: "REMIND_ME",
		name: "REMIND_ME"
	},
	changeDefaultSnoozeTime: {
		value: "CHANGE_DEFAULT_SNOOZE_TIME",
		name: "CHANGE_DEFAULT_SNOOZE_TIME"
	},
	changeDefaultBreakTime: {
		value: "CHANGE_DEFAULT_BREAK_TIME",
		name: "CHANGE_DEFAULT_BREAK_TIME"
	}
}

export const timeZones = {
	eastern: {
		tz: "America/Indiana/Indianapolis",
		name: "Eastern"
	},
	central: {
		tz: "America/Chicago",
		name: "Central"
	},
	mountain: {
		tz: "America/Denver",
		name: "Mountain"
	},
	pacific: {
		tz: "America/Los_Angeles",
		name: "Pacific"
	}
}

export const tokiOptionsAttachment = [
	{
		text: "planning which tasks you intend to work on each day",
		color: colorsHash.blue.hex,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Starting your day"
	},
	{
		text: "launching work sessions to get those tasks done",
		color: colorsHash.green.hex,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Launching work sessions"
	},
	{
		text: "setting reminders to keep you on top of your tasks and obligations",
		color: colorsHash.yellow.hex,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Setting reminders"
	},
	{
		text: "adjusting your prioritized tasks on the fly",
		color: colorsHash.salmon.hex,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Starting your day"
	}
]

export const tokiOptionsExtendedAttachment = [
	{
		title: "Planning the day",
		text: "Say `lets plan` to set the tasks you intend to accomplish each day and estimate how long each will take you",
		mrkdwn_in: [ "text" ],
		color: colorsHash.blue.hex,
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Planning your day"
	},
	{
		title: "Launching work sessions",
		text: "Say `start a session` to kick off a focused work session to accomplish specific tasks",
		mrkdwn_in: [ "text" ],
		color: colorsHash.green.hex,
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Launching work sessions"
	},
	{
		title: "Setting reminders",
		text: "Say `I'd like a reminder` or use the shorthand `/note` if you want me to remind you about whatever you'd like at any time or duration",
		mrkdwn_in: [ "text" ],
		color: colorsHash.yellow.hex,
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Setting reminders"
	},
	{
		title: "Viewing and editing priorities on the fly",
		text: "Say `edit tasks` to update your tasks and time estimates throughout the day, and use the shorthand `/add` to quickly write things down",
		mrkdwn_in: [ "text" ],
		color: colorsHash.salmon.hex,
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Starting your day"
	}
]

export const sessionTimerDecisions = {
	didTask: "DID_TASK",
	snooze: "SNOOZE",
	didSomethingElse: "DID_SOMETHING_ELSE",
	noTasks: "NO_TASKS",
	newSession: "NEW_SESSION",
	cancelSession: "CANCEL_SESSION"
}

export const taskListMessageDoneButtonAttachment = [
	{
		attachment_type: 'default',
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "Which additional tasks do you want to work on?",
		color: colorsHash.grey.hex,
		actions: [
			{
					name: buttonValues.doneAddingTasks.name,
					text: "Done",
					value: buttonValues.doneAddingTasks.value,
					type: "button",
					style: "primary"
			}
		]
	}
];

export const taskListMessageDoneAndDeleteButtonAttachment = [
	{
		attachment_type: 'default',
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "Which additional tasks do you want to work on?",
		color: colorsHash.grey.hex,
		actions: [
			{
					name: buttonValues.doneAddingTasks.name,
					text: "Done",
					value: buttonValues.doneAddingTasks.value,
					type: "button",
					style: "primary"
			},
			{
				name: buttonValues.deleteTasks.name,
				text: "Delete tasks",
				value: buttonValues.deleteTasks.value,
				type: "button"
			}
		]
	}
];

export const taskListMessageAddMoreTasksButtonAttachment = [
	{
		attachment_type: 'default',
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "How much time would you like to allocate to your tasks?",
		color: colorsHash.grey.hex,
		actions: [
			{
					name: buttonValues.actuallyWantToAddATask.name,
					text: "Add more tasks!",
					value: buttonValues.actuallyWantToAddATask.value,
					type: "button"
			}
		]
	}
];

export const taskListMessageYesButtonAttachment = [
	{
		attachment_type: 'default',
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "Here is your task list",
		color: colorsHash.grey.hex,
		actions: [
			{
					name: buttonValues.yes.name,
					text: "Yes!",
					value: buttonValues.yes.value,
					type: "button",
					style: "primary"
			}
		]
	}
];

export const taskListMessageNoButtonsAttachment = [
	{
		attachment_type: 'default',
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "Here is your task list",
		color: colorsHash.grey.hex
	}
];

export const taskListMessageAddMoreTasksAndResetTimesButtonAttachment = [
	{
		attachment_type: 'default',
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "How much time would you like to allocate to your tasks?",
		color: colorsHash.grey.hex,
		actions: [
			{
					name: buttonValues.actuallyWantToAddATask.name,
					text: "Add more tasks!",
					value: buttonValues.actuallyWantToAddATask.value,
					type: "button"
			},
			{
					name: buttonValues.resetTimes.name,
					text: "Reset times",
					value: buttonValues.resetTimes.value,
					type: "button",
					style: "danger"
			}
		]
	}
];

export const taskListMessageResetTimesButtonAttachment = [
	{
		attachment_type: 'default',
		callback_id: "TASK_LIST_MESSAGE",
		fallback: "How much time would you like to allocate to your tasks?",
		color: colorsHash.grey.hex,
		actions: [
			{
					name: buttonValues.actuallyWantToAddATask.name,
					text: "Add more tasks!",
					value: buttonValues.actuallyWantToAddATask.value,
					type: "button"
			}
		]
	}
];


export const startSessionOptionsAttachments = [
	{
		attachment_type: 'default',
		callback_id: "START_SESSION_OPTIONS",
		fallback: "Good luck with your session!",
		actions: [
			{
					name: buttonValues.startSession.pause.name,
					text: "Pause",
					value: buttonValues.startSession.pause.value,
					type: "button"
			},
			{
					name: buttonValues.startSession.addCheckIn.name,
					text: "Add check-in",
					value: buttonValues.startSession.addCheckIn.value,
					type: "button"
			},
			{
					name: buttonValues.startSession.endEarly.name,
					text: "End Early",
					value: buttonValues.startSession.endEarly.value,
					type: "button",
					style: "danger"
			}
		]
	}
]


