import moment from 'moment';

export const TOKI_DEFAULT_SNOOZE_TIME = 15;
export const TOKI_DEFAULT_BREAK_TIME = 10;
export const hoursForExpirationTime = 6;
export const MINUTES_FOR_DONE_SESSION_TIMEOUT = 30;

export const dateOfNewPlanDayFlow = "2016-08-13";

export const startDayExpirationTime = moment().subtract(hoursForExpirationTime, 'hours').format("YYYY-MM-DD HH:mm:ss Z");

export const intentConfig = {
	START_DAY: 'start_day',
	END_DAY: 'end_day',
	START_SESSION: 'start_session',
	END_SESSION: 'end_session',
	VIEW_PLAN: 'view_plan',
	END_PLAN: 'end_plan',
	KEEP_WORKING: `keep_working`
}

export const constants = {
	PLAN_DECISION: {
		complete: {
			word: "TASK_COMPLETE",
			reg_exp: new RegExp(/(\bcomp[omplete]{3,}\b|\bche[heck]{1,}\b|\bcro[ross]{1,}\b)/i)
		},
		add: {
			word: "TASK_ADD",
			reg_exp: new RegExp(/\bad[ad]{1,}\b/i)
		},
		view: {
			word: "TASK_VIEW",
			reg_exp: new RegExp(/\bvi[iew]{1,}\b/i)
		},
		delete: {
			word: "TASK_DELETE",
			reg_exp: new RegExp(/\b(del[elete]{2,8}|rem[move]{2,6})\b/i)
		},
		edit: {
			word: "TASK_EDIT",
			reg_exp: new RegExp(/\bed[dit]{1,}\b/i)
		},
		work: {
			word: "TASK_WORK",
			reg_exp: new RegExp(/\b(do[o]?|wor[ork]{1,})\b/i)
		},
		revise: {
			word: "TASK_REVISE",
			reg_exp: new RegExp(/\brev[ise]{2,4}\b/i)
		}
	},
	FINISH_WORD: {
		word: "done",
		reg_exp: new RegExp(/^d[one]{2,}\b/i)
	},
	 NONE: {
		word: "none",
		reg_exp: new RegExp(/^[none]{3,}e$/i)
	},
	RESET: {
		word: "reset",
		reg_exp: new RegExp(/^r[reset]{3,}\b/i)
	},
	ANY_CHARACTER: {
		reg_exp: new RegExp(/\D/i)
	},
	THANK_YOU: {
		word: "thank you",
		reg_exp: new RegExp(/(^t(?=.*n)[thanks you]{4,}\b|^t(?=.*n)[thanksyou]{5,}\b|^t(?=.*x)[thx]{2,4}\b|^ty[y]{0,}\b)/i)
	},
	DURATION_INTENT: {
		word: "duration",
		reg_exp: new RegExp((/((\b[\d]+( [hoursminutes]+\b|[hoursminutes]+\b))|([forin]{2,}[ ]?[\d]+\b)|(\bh[our]{2,}|\bm[inutes]{2,}))/i))
	},
	TIME_INTENT: {
		word: "time",
		reg_exp: new RegExp((/(:|[at]{2,}[ ]?[\d]+\b)/i))
	},
	MORNING: {
		word: "morning",
		hour: 0
	},
	AFTERNOON: {
		word: "afternoon",
		hour: 14
	},
	EVENING: {
		word: "evening",
		hour: 18
	}
}

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
	},
	toki_purple: {
		hex: "#8a3df0"
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
		value: "Yes, let's start!"
	},
	checkIn: {
		name: "CHECK_IN",
		value: "CHECK_IN"
	},
	changeTask: {
		name: "CHANGE_TASK",
		value: "Let's change tasks"
	},
	changePriority: {
		name: "CHANGE_PRIORITY",
		value: "Let's change priorities"
	},
	changeSessionTime: {
		name: "CHANGE_SESSION_TIME",
		value: "Let's change times"
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
			value: "START_SESSION_PAUSE",
			endEarly: {
				name: "START_SESSION_PAUSE_END_EARLY",
				value: "START_SESSION_PAUSE_END_EARLY"
			}
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
		value: "end my day"
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
		value: "I'll keep my name"
	},
	differentName: {
		name: "DIFFERENT_NAME",
		value: "I'll choose a different name"
	},
	timeZones: {
		eastern: {
			name: "EASTERN_TIME",
			value: "Eastern timezone"
		},
		central: {
			name: "CENTRAL_TIME",
			value: "Central timezone"
		},
		mountain: {
			name: "MOUNTAIN_TIME",
			value: "Mountain timezone"
		},
		pacific: {
			name: "PACIFIC_TIME",
			value: "Pacific timezone"
		},
		other: {
			name: "OTHER_TIMEZONE",
			value: "other timezone"
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
		value: "Never mind!"
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
		value: "Done",
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
		name: "yes!"
	},
	no: {
		value: "NO",
		name: "nope!"
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
	},
	undoTaskComplete: {
		value: "UNDO_TASK_COMPLETE",
		name: "UNDO_TASK_COMPLETE"
	},
	undoTaskDelete: {
		value: "UNDO_TASK_DELETE",
		name: "UNDO_TASK_DELETE"
	},
	planCommands: { // value will be NL single line commands
		deletePriority: {
			name: "PLAN_DELETE_PRIORITY",
			value: "delete priority"
		},
		completePriority: {
			name: "PLAN_COMPLETE_PRIORITY",
			value: "complete priority"
		},
		addPriority: {
			name: "PLAN_ADD_PRIORITY",
			value: "add priority"
		},
		workOnPriority: {
			name: "PLAN_WORK_ON_PRIORITY",
			value: "work on priority"
		},
		revisePriority: {
			name: "PLAN_REVISE_PRIORITY",
			value: "revise priority"
		},
		endDay: {
			name: "PLAN_END_DAY",
			value: "end my day"
		},
		actuallyDontWantToAddPriority: {
			name: "PLAN_DONT_WANT_TO_ADD_PRIORITY",
			value: "Never mind, I don't want to add another priority"
		},
		actuallyLetsRenamePriority: {
			name: "PLAN_LETS_RENAME_PRIORITY",
			value: "Actually, let's rename this priority"
		}
	},
	redoTasks: {
		name: "REDO_TASKS",
		value: "REDO_TASKS"
	},
	workOnDifferentTask: {
		name: "WORK_ON_DIFFERENT_TASK",
		value: "Let's choose a different task!"
	},
	redoMyPriorities: {
		name: "REDO_MY_PRIORITIES",
		value: "Let's redo my priorities!"
	},
	wizardNewPlanFlow: {
		name: "WIZARD_NEW_PLAN_FLOW",
		value: "Help me figure that out!"
	},
	keepTaskOrder: {
		name: "KEEP_TASK_ORDER",
		value: "Keep this order!"
	},
	workOnTaskFor: {
		ninetyMinutes: {
			name: "WORK_ON_TASK_FOR_90_MINUTES",
			value: "90 minutes"
		},
		sixtyMinutes: {
			name: "WORK_ON_TASK_FOR_60_MINUTES",
			value: "60 minutes"
		},
		thirtyMinutes: {
			name: "WORK_ON_TASK_FOR_30_MINUTES",
			value: "30 minutes"
		},
		fifteenMinutes: {
			name: "WORK_ON_TASK_FOR_15_MINUTES",
			value: "15 minutes"
		}
	},
	startTaskIn: {
		now: {
			name: "WORK_ON_TASK_NOW",
			value: "Let's do this task right now!" 
		},
		tenMinutes: {
			name: "WORK_ON_TASK_IN_10_MINUTES",
			value: "in 10 minutes" 
		}
	},
	include: {
		noOne: {
			name: "INCLUDE_NO_ONE",
			value: "No one for now!"
		}
	},
	doneSession: {
		completedPriorityTonedDown: {
			name: "DONE_SESSION_TONED_DOWN_COMPLETED_PRIORITY",
			value: "completed my priority early"
		},
		completedPriority: {
			name: "DONE_SESSION_COMPLETED_PRIORITY",
			value: "completed my priority!"
		},
		takeBreak: {
			name: "DONE_SESSION_TAKE_BREAK",
			value: "take a break"
		},
		extendSession: {
			name: "DONE_SESSION_EXTEND_SESSION",
			value: "extend my session"
		},
		newSession: {
			name: "DONE_SESSION_NEW_SESSION",
			value: "new session"
		},
		viewPlan: {
			name: "DONE_SESSION_VIEW_PLAN",
			value: "view my plan"
		},
		endDay: {
			name: "DONE_SESSION_END_DAY",
			value: "end my day"
		},
		notDone: {
			name: "DONE_SESSION_NOT_DONE_WITH_PRIORITY",
			value: "not yet done"
		},
		didSomethingElse: {
			name: "DONE_SESSION_DID_SOMETHING_ELSE",
			value: "I did something else!"
		},
		moveOn: {
			name: "MOVE_ON",
			value: "Let's move on!"
		},
		itWasSomethingElse: {
			name: "DONE_SESSION_IT_WAS_SOMETHING_ELSE",
			value: "it was something else!"
		},
		keepMyPriority: {
			name: "DONE_SESSION_KEEP_MY_PRIORITIES",
			value: "i'll keep my priorities!!"
		},
		beBackLater: {
			name: "DONE_SESSION_BE_BACK_LATER",
			value: "i'll be back later!"
		}
	},
	doneWithBreak: {
		name: "DONE_WITH_BREAK",
		value: "let's do it"
	},
	keepPriority: {
		name: "KEEP_PRIORITY",
		value: "i'll keep my priorities"
	},
	doneEarly: {
		name: "SESSION_DONE_EARLY",
		value: "im done!"
	},
	addCheckIn: {
		name: "SESSION_ADD_CHECK_IN",
		value: "let's add a check in!"
	},
	notToday: {
		name: "NOT_TODAY",
		value: "not today"
	},
	keepWorking: {
		name: "KEEP_WORKING",
		value: "i want to keep working"
	},
	notShare: {
		name: "LETS_NOT_SHARE",
		value: "let's not share today"
	},
	newPlan: {
		redoLastPriority: {
			name: "REDO_LAST_PRIORITY",
			value: "redo last priority"
		},
		noMorePriorities: {
			name: "NO_MORE_PRIORITIES",
			value: "no more priorities"
		}
	},
	noDontAskAgain: {
		name: "NO_DONT_ASK_AGAIN",
		value: "no, and don't ask again"
	},
	yesDontAskAgain: {
		name: "YES_DONT_ASK_AGAIN",
		value: "yes, and don't ask again"
	},
	next: {
		name: "NEXT",
		value: "next"
	},
	now: {
		name: "NOW",
		value: "now!"
	},
	inTenMinutes: {
		name: "IN_TEN_MINUTES",
		value: "in 10 minutes"
	},
	goBack: {
		name: "GO_BACK",
		value: "go back!"
	},
	letsWinTheDay: {
		name: "LETS_WIN_THE_DAY",
		value: "lets win the day!"
	},
	letsDoIt: {
		name: "LETS_DO_IT",
		value: "lets do it!"
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

export const approvalWords = ['nice', 'awesome', 'sounds good', 'great', 'fantastic', 'looking good', 'very nice', 'cool', 'boom', 'looks good'];

export const quotes = [
	{
		message: "By failing to prepare, you are preparing to fail.",
		author: "Benjamin Franklin"
	},
	{
		message: "Give me six hours to chop down a tree and I will spend the first four sharpening the axe.",
		author: "Abraham Lincoln"
	},
	{
		message: "If you don't know where you are going, you'll end up someplace else.",
		author: "Yogi Berra"
	},
	{
		message: "In preparing for battle I have always found that plans are useless, but planning is indispensable.",
		author: "Dwight D. Eisenhower"
	},
	{
		message: "Someone's sitting in the shade today because someone planted a tree a long time ago.",
		author: "Warren Buffett"
	},
	{
		message: "Unless commitment is made, there are only promises and hopes; but no plans.",
		author: "Peter F. Drucker"
	},
	{
		message: "Unfortunately, there seems to be far more opportunity out there than ability.... We should remember that good fortune often happens when opportunity meets with preparation.",
		author: "Thomas A. Edison"
	},
	{
		message: "I believe luck is preparation meeting opportunity. If you hadn’t been prepared when the opportunity came along, you wouldn’t have been lucky.",
		author: "Oprah Winfrey"
	},
	{
		message: "If I had an hour to solve a problem I'd spend 55 minutes thinking about the problem and 5 minutes thinking about solutions.",
		author: "Albert Einstein"
	},
	{
		message: "If you really look closely, most overnight successes took a long time.",
		author: "Steve Jobs"
	}
]

export const tokiOptionsAttachment = [
	{
		text: "Instead of treating each day as a never-ending list of todos, I help you *identify the top 3 priorities* that define your day, *_and actually accomplish them_*",
		color: colorsHash.salmon.hex,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Identify and do your 3 priorities"
	},
	{
		text: "These are often the priorities that are difficult to make time for and get focused on, but are what *create big outcomes for yourself and your team*",
		color: colorsHash.blue.hex,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Do the most important things"
	},
	{
		text: "I realize you likely work on more than three tasks each day. I'm here to make sure you *get 3 things done that are critically important to your day, but might get lost or pushed back* if you don't deliberately make time for them",
		color: colorsHash.yellow.hex,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Accomplish your 3 main priorities to win the day"
	},
	{
		text: "I can also send these top 3 priorities with anyone on your team if you'd like to *share what you're working on*",
		color: colorsHash.lavendar.hex,
		mrkdwn_in: [ "text" ],
		attachment_type: "default",
		callback_id: "TOKI_OPTIONS",
		fallback: "Share with your team"
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
		callback_id: "LIVE_SESSION_OPTIONS",
		fallback: "Good luck with your session!",
		actions: [
			{
					name: buttonValues.startSession.pause.name,
					text: "Pause",
					value: buttonValues.startSession.pause.value,
					type: "button"
			},
			{
					name: buttonValues.addCheckIn.name,
					text: "Add check-in",
					value: buttonValues.addCheckIn.value,
					type: "button"
			},
			{
					name: buttonValues.doneEarly.name,
					text: "End Session Early",
					value: buttonValues.doneEarly.value,
					type: "button"
			}
		]
	}
]

export const pausedSessionOptionsAttachments = [
	{
		attachment_type: 'default',
		callback_id: "PAUSED_SESSION_OPTIONS",
		fallback: "Your session is paused!",
		actions: [
			{
					name: buttonValues.startSession.resume.name,
					text: "Resume",
					value: buttonValues.startSession.resume.value,
					type: "button",
					style: "primary"
			},
			{
					name: buttonValues.doneEarly.name,
					text: "End Session",
					value: buttonValues.doneEarly.value,
					type: "button"
			}
		]
	}
];

export const endBreakEarlyAttachments = [
	{
		attachment_type: 'default',
		callback_id: "END_BREAK_EARLY",
		fallback: "I'm ready to get started!!",
		actions: [
			{
					name: buttonValues.doneWithBreak.name,
					text: "I'm back early!",
					value: buttonValues.doneWithBreak.value,
					type: "button"
			}
		]
	}
];
