'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.pausedSessionOptionsAttachments = exports.startSessionOptionsAttachments = exports.taskListMessageResetTimesButtonAttachment = exports.taskListMessageAddMoreTasksAndResetTimesButtonAttachment = exports.taskListMessageNoButtonsAttachment = exports.taskListMessageYesButtonAttachment = exports.taskListMessageAddMoreTasksButtonAttachment = exports.taskListMessageDoneAndDeleteButtonAttachment = exports.taskListMessageDoneButtonAttachment = exports.sessionTimerDecisions = exports.tokiOptionsExtendedAttachment = exports.tokiOptionsAttachment = exports.timeZones = exports.buttonValues = exports.colorsArray = exports.colorsHash = exports.constants = exports.intentConfig = exports.startDayExpirationTime = exports.dateOfNewPlanDayFlow = exports.MINUTES_FOR_DONE_SESSION_TIMEOUT = exports.hoursForExpirationTime = exports.TOKI_DEFAULT_BREAK_TIME = exports.TOKI_DEFAULT_SNOOZE_TIME = undefined;

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var TOKI_DEFAULT_SNOOZE_TIME = exports.TOKI_DEFAULT_SNOOZE_TIME = 15;
var TOKI_DEFAULT_BREAK_TIME = exports.TOKI_DEFAULT_BREAK_TIME = 10;
var hoursForExpirationTime = exports.hoursForExpirationTime = 6;
var MINUTES_FOR_DONE_SESSION_TIMEOUT = exports.MINUTES_FOR_DONE_SESSION_TIMEOUT = 30;

var dateOfNewPlanDayFlow = exports.dateOfNewPlanDayFlow = "2016-07-30";

var startDayExpirationTime = exports.startDayExpirationTime = (0, _moment2.default)().subtract(hoursForExpirationTime, 'hours').format("YYYY-MM-DD HH:mm:ss Z");

var intentConfig = exports.intentConfig = {
	START_DAY: 'start_day',
	END_DAY: 'end_day',
	START_SESSION: 'start_session',
	END_SESSION: 'end_session'
};

var constants = exports.constants = {
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
			reg_exp: new RegExp(/\bdel[elete]{3,}\b/i)
		},
		edit: {
			word: "TASK_EDIT",
			reg_exp: new RegExp(/\bed[dit]{1,}\b/i)
		},
		work: {
			word: "TASK_WORK",
			reg_exp: new RegExp(/\b(do[o]?|wor[ork]{1,})\b/i)
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
		reg_exp: new RegExp(/((\b[\d]+( [hoursminutes]+\b|[hoursminutes]+\b))|([forin]{2,}[ ]?[\d]+\b)|(\bh[our]{2,}|\bm[inutes]{2,}))/i)
	},
	TIME_INTENT: {
		word: "time",
		reg_exp: new RegExp(/(:|[at]{2,}[ ]?[\d]+\b)/i)
	},
	MORNING: {
		word: "day",
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
};

var colorsHash = exports.colorsHash = {
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
exports.colorsArray = colorsArray;
var buttonValues = exports.buttonValues = {
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
	noPendingTasks: {
		name: "NO_PENDING_TASKS",
		value: "NO_PENDING_TASKS"
	},
	noAdditionalTasks: {
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
		deleteTasks: {
			name: "PLAN_DELETE_TASKS",
			value: "delete priorities"
		},
		completeTasks: {
			name: "PLAN_COMPLETE_TASKS",
			value: "complete priorities"
		},
		addTasks: {
			name: "PLAN_ADD_TASKS",
			value: "add priorities"
		},
		workOnTasks: {
			name: "PLAN_WORK_ON_TASKS",
			value: "work on priorities"
		}
	},
	endOfPlanCommands: { // value will be NL single line commands
		deleteTasks: {
			name: "END_OF_PLAN_DELETE_TASKS",
			value: "END_OF_PLAN_DELETE_TASKS"
		},
		completeTasks: {
			name: "END_OF_PLAN_COMPLETE_TASKS",
			value: "END_OF_PLAN_COMPLETE_TASKS"
		},
		addTasks: {
			name: "END_OF_PLAN_ADD_TASKS",
			value: "END_OF_PLAN_ADD_TASKS"
		},
		workOnTasks: {
			name: "END_OF_PLAN_WORK_ON_TASKS",
			value: "END_OF_PLAN_WORK_ON_TASKS"
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
	}
};

var timeZones = exports.timeZones = {
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
};

var tokiOptionsAttachment = exports.tokiOptionsAttachment = [{
	text: "Instead of treating each day as a never-ending list of todos, I help you *identify the top 3 priorities* that define your day, *_and actually accomplish them_*",
	color: colorsHash.salmon.hex,
	mrkdwn_in: ["text"],
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Identify and do your 3 priorities"
}, {
	text: "These are often the priorities that are difficult to make time for and get focused on, but are what *create big outcomes for yourself and your team*",
	color: colorsHash.blue.hex,
	mrkdwn_in: ["text"],
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Do the most important things"
}, {
	text: "I realize you likely work on more than three tasks each day. I'm here to make sure you *get 3 things done that are critically important to your day, but might get lost or pushed back* if you don't deliberately make time for them",
	color: colorsHash.yellow.hex,
	mrkdwn_in: ["text"],
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Accomplish your 3 main priorities to win the day"
}, {
	text: "I can also send these top 3 priorities with anyone on your team if you'd like to *share what you're working on*",
	color: colorsHash.lavendar.hex,
	mrkdwn_in: ["text"],
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Share with your team"
}];

var tokiOptionsExtendedAttachment = exports.tokiOptionsExtendedAttachment = [{
	title: "Planning the day",
	text: "Say `lets plan` to set the tasks you intend to accomplish each day and estimate how long each will take you",
	mrkdwn_in: ["text"],
	color: colorsHash.blue.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Planning your day"
}, {
	title: "Launching work sessions",
	text: "Say `start a session` to kick off a focused work session to accomplish specific tasks",
	mrkdwn_in: ["text"],
	color: colorsHash.green.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Launching work sessions"
}, {
	title: "Setting reminders",
	text: "Say `I'd like a reminder` or use the shorthand `/note` if you want me to remind you about whatever you'd like at any time or duration",
	mrkdwn_in: ["text"],
	color: colorsHash.yellow.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Setting reminders"
}, {
	title: "Viewing and editing priorities on the fly",
	text: "Say `edit tasks` to update your tasks and time estimates throughout the day, and use the shorthand `/add` to quickly write things down",
	mrkdwn_in: ["text"],
	color: colorsHash.salmon.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Starting your day"
}];

var sessionTimerDecisions = exports.sessionTimerDecisions = {
	didTask: "DID_TASK",
	snooze: "SNOOZE",
	didSomethingElse: "DID_SOMETHING_ELSE",
	noTasks: "NO_TASKS",
	newSession: "NEW_SESSION",
	cancelSession: "CANCEL_SESSION"
};

var taskListMessageDoneButtonAttachment = exports.taskListMessageDoneButtonAttachment = [{
	attachment_type: 'default',
	callback_id: "TASK_LIST_MESSAGE",
	fallback: "Which additional tasks do you want to work on?",
	color: colorsHash.grey.hex,
	actions: [{
		name: buttonValues.doneAddingTasks.name,
		text: "Done",
		value: buttonValues.doneAddingTasks.value,
		type: "button",
		style: "primary"
	}]
}];

var taskListMessageDoneAndDeleteButtonAttachment = exports.taskListMessageDoneAndDeleteButtonAttachment = [{
	attachment_type: 'default',
	callback_id: "TASK_LIST_MESSAGE",
	fallback: "Which additional tasks do you want to work on?",
	color: colorsHash.grey.hex,
	actions: [{
		name: buttonValues.doneAddingTasks.name,
		text: "Done",
		value: buttonValues.doneAddingTasks.value,
		type: "button",
		style: "primary"
	}, {
		name: buttonValues.deleteTasks.name,
		text: "Delete tasks",
		value: buttonValues.deleteTasks.value,
		type: "button"
	}]
}];

var taskListMessageAddMoreTasksButtonAttachment = exports.taskListMessageAddMoreTasksButtonAttachment = [{
	attachment_type: 'default',
	callback_id: "TASK_LIST_MESSAGE",
	fallback: "How much time would you like to allocate to your tasks?",
	color: colorsHash.grey.hex,
	actions: [{
		name: buttonValues.actuallyWantToAddATask.name,
		text: "Add more tasks!",
		value: buttonValues.actuallyWantToAddATask.value,
		type: "button"
	}]
}];

var taskListMessageYesButtonAttachment = exports.taskListMessageYesButtonAttachment = [{
	attachment_type: 'default',
	callback_id: "TASK_LIST_MESSAGE",
	fallback: "Here is your task list",
	color: colorsHash.grey.hex,
	actions: [{
		name: buttonValues.yes.name,
		text: "Yes!",
		value: buttonValues.yes.value,
		type: "button",
		style: "primary"
	}]
}];

var taskListMessageNoButtonsAttachment = exports.taskListMessageNoButtonsAttachment = [{
	attachment_type: 'default',
	callback_id: "TASK_LIST_MESSAGE",
	fallback: "Here is your task list",
	color: colorsHash.grey.hex
}];

var taskListMessageAddMoreTasksAndResetTimesButtonAttachment = exports.taskListMessageAddMoreTasksAndResetTimesButtonAttachment = [{
	attachment_type: 'default',
	callback_id: "TASK_LIST_MESSAGE",
	fallback: "How much time would you like to allocate to your tasks?",
	color: colorsHash.grey.hex,
	actions: [{
		name: buttonValues.actuallyWantToAddATask.name,
		text: "Add more tasks!",
		value: buttonValues.actuallyWantToAddATask.value,
		type: "button"
	}, {
		name: buttonValues.resetTimes.name,
		text: "Reset times",
		value: buttonValues.resetTimes.value,
		type: "button",
		style: "danger"
	}]
}];

var taskListMessageResetTimesButtonAttachment = exports.taskListMessageResetTimesButtonAttachment = [{
	attachment_type: 'default',
	callback_id: "TASK_LIST_MESSAGE",
	fallback: "How much time would you like to allocate to your tasks?",
	color: colorsHash.grey.hex,
	actions: [{
		name: buttonValues.actuallyWantToAddATask.name,
		text: "Add more tasks!",
		value: buttonValues.actuallyWantToAddATask.value,
		type: "button"
	}]
}];

var startSessionOptionsAttachments = exports.startSessionOptionsAttachments = [{
	attachment_type: 'default',
	callback_id: "LIVE_SESSION_OPTIONS",
	fallback: "Good luck with your session!",
	actions: [{
		name: buttonValues.startSession.pause.name,
		text: "Pause",
		value: buttonValues.startSession.pause.value,
		type: "button"
	}, {
		name: buttonValues.startSession.addCheckIn.name,
		text: "Add check-in",
		value: buttonValues.startSession.addCheckIn.value,
		type: "button"
	}, {
		name: buttonValues.startSession.endEarly.name,
		text: "End Session Early",
		value: buttonValues.startSession.endEarly.value,
		type: "button"
	}]
}];

var pausedSessionOptionsAttachments = exports.pausedSessionOptionsAttachments = [{
	attachment_type: 'default',
	callback_id: "PAUSED_SESSION_OPTIONS",
	fallback: "Your session is paused!",
	actions: [{
		name: buttonValues.startSession.resume.name,
		text: "Resume",
		value: buttonValues.startSession.resume.value,
		type: "button",
		style: "primary"
	}, {
		name: buttonValues.startSession.pause.endEarly.name,
		text: "End Session",
		value: buttonValues.startSession.pause.endEarly.value,
		type: "button"
	}]
}];
//# sourceMappingURL=constants.js.map