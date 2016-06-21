"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
var FINISH_WORD = exports.FINISH_WORD = {
	word: "done",
	reg_exp: new RegExp(/^[dD][oOnNeE]*/)
};

var NONE = exports.NONE = {
	word: "none",
	reg_exp: new RegExp(/^[nN][oOnNeE]*/)
};

var EXIT_EARLY_WORDS = exports.EXIT_EARLY_WORDS = ['exit', 'stop', 'never mind', 'quit'];
//# sourceMappingURL=constants.js.map