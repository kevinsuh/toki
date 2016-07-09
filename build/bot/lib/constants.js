'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.sessionTimerDecisions = exports.tokiOptionsExtendedAttachment = exports.tokiOptionsAttachment = exports.timeZones = exports.buttonValues = exports.colorsArray = exports.colorsHash = exports.EXIT_EARLY_WORDS = exports.TIME_INTENT = exports.DURATION_INTENT = exports.THANK_YOU = exports.RESET = exports.NONE = exports.FINISH_WORD = exports.startDayExpirationTime = exports.MINUTES_FOR_DONE_SESSION_TIMEOUT = exports.hoursForExpirationTime = exports.TOKI_DEFAULT_SNOOZE_TIME = undefined;

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var TOKI_DEFAULT_SNOOZE_TIME = exports.TOKI_DEFAULT_SNOOZE_TIME = 9;

var hoursForExpirationTime = exports.hoursForExpirationTime = 6;

var MINUTES_FOR_DONE_SESSION_TIMEOUT = exports.MINUTES_FOR_DONE_SESSION_TIMEOUT = 30;

var startDayExpirationTime = exports.startDayExpirationTime = (0, _moment2.default)().subtract(hoursForExpirationTime, 'hours').format("YYYY-MM-DD HH:mm:ss Z");

var FINISH_WORD = exports.FINISH_WORD = {
	word: "done",
	reg_exp: new RegExp(/^d[one]{2,}\b/i)
};

var NONE = exports.NONE = {
	word: "none",
	reg_exp: new RegExp(/^[none]{3,}e$/i)
};

var RESET = exports.RESET = {
	word: "reset",
	reg_exp: new RegExp(/^r[reset]{3,}\b/i)
};

var THANK_YOU = exports.THANK_YOU = {
	word: "thank you",
	reg_exp: new RegExp(/(^[thanksyou]{5,}\b|^[thx]{3,5}\b|^[ty]{2,3}\b)/i)
};

// contains an intent for duration and not datetime
var DURATION_INTENT = exports.DURATION_INTENT = {
	word: "duration",
	reg_exp: new RegExp(/((\b[\d]+( [hoursminutes]+\b|[hoursminutes]+\b))|([forin]{2,}[ ]?[\d]+\b)|(\bh[our]{2,}|\bm[inutes]{2,}))/i)
};

var TIME_INTENT = exports.TIME_INTENT = {
	word: "time",
	reg_exp: new RegExp(/(:|[at]{2,}[ ]?[\d]+\b)/i)
};

var EXIT_EARLY_WORDS = exports.EXIT_EARLY_WORDS = ['exit', 'stop', 'never mind', 'quit'];

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
		value: "START_SESSION"
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
	text: "planning which tasks you intend to work on each day",
	color: colorsHash.blue.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Starting your day"
}, {
	text: "launching work sessions to get those tasks done",
	color: colorsHash.green.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Launching work sessions"
}, {
	text: "setting reminders to keep you on top of your tasks and obligations",
	color: colorsHash.yellow.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Setting reminders"
}, {
	text: "adjusting your prioritized tasks on the fly",
	color: colorsHash.salmon.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Starting your day"
}];

var tokiOptionsExtendedAttachment = exports.tokiOptionsExtendedAttachment = [{
	fields: [{
		title: "Starting your day",
		value: 'Say "start my day" to plan the tasks you intend to accomplish each day and estimate how long each will take you'
	}],
	color: colorsHash.blue.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Starting your day"
}, {
	fields: [{
		title: "Launching work sessions",
		value: 'Say "start a session" to kick off a focused work session to accomplish specific tasks'
	}],
	color: colorsHash.green.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Launching work sessions"
}, {
	fields: [{
		title: "Setting reminders",
		value: 'Say "I\'d like a reminder" to prompt me to remind you about whatever you\'d like at any time or duration'
	}],
	color: colorsHash.yellow.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Setting reminders"
}, {
	fields: [{
		title: "Viewing and adjusting priorities on the fly",
		value: 'Say "view tasks" to view your unfinished tasks each day and change your priorities by adding tasks or adjusting time estimates'
	}],
	color: colorsHash.salmon.hex,
	attachment_type: "default",
	callback_id: "TOKI_OPTIONS",
	fallback: "Starting your day"
}];

var sessionTimerDecisions = exports.sessionTimerDecisions = {
	didTask: "DID_TASK",
	snooze: "SNOOZE",
	didSomethingElse: "DID_SOMETHING_ELSE",
	noTasks: "NO_TASKS"
};
//# sourceMappingURL=constants.js.map