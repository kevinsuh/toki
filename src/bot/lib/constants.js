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

export const EXIT_EARLY_WORDS = ['exit', 'stop','never mind','quit'];

export const colorsHash = {
	green: {
		hex: "#36a64f"
	},
	darkBlue: {
		hex: "#000057"
	},
	salmon: {
		hex: "#bb4444"
	},
	lavendar: {
		hex: "6e4474"
	},
	turquoise: {
		hex: "#44bbbb"
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

