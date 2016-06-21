"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
var FINISH_WORD = exports.FINISH_WORD = {
	word: "done",
	reg_exp: new RegExp(/^[done]{3,}e$/i)
};

var NONE = exports.NONE = {
	word: "none",
	reg_exp: new RegExp(/^[none]{3,}e$/i)
};

var EXIT_EARLY_WORDS = exports.EXIT_EARLY_WORDS = ['exit', 'stop', 'never mind', 'quit'];
//# sourceMappingURL=constants.js.map