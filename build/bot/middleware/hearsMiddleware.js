'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.isJsonObject = isJsonObject;

var _index = require('../controllers/index');

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isJsonObject(patterns, message) {
	var text = message.text;

	try {
		JSON.parse(text);
		return true;
	} catch (error) {
		return false;
	}
}
//# sourceMappingURL=hearsMiddleware.js.map