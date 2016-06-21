export const FINISH_WORD = {
	word: "done",
	reg_exp: new RegExp(/^[done]{3,}e$/i)
};

export const NONE = {
	word: "none",
	reg_exp: new RegExp(/^[none]{3,}e$/i)
};

export const EXIT_EARLY_WORDS = ['exit', 'stop','never mind','quit'];