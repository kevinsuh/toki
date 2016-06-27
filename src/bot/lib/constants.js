export const FINISH_WORD = {
	word: "done",
	reg_exp: new RegExp(/^[done]{3,}e$/i)
};

export const NONE = {
	word: "none",
	reg_exp: new RegExp(/^[none]{3,}e$/i)
};

export const THANK_YOU = {
	word: "thank you",
	reg_exp: new RegExp(/(^[thanksyou]{5,}\b|^[thx]{3,5}\b|^[ty]{2,3}\b)/i)
}

// contains an intent for duration and not custom_time
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
	grey: {
		hex: "#C1C1C3"
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
	}
}

