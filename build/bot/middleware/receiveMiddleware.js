'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _index = require('../controllers/index');

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// add receive middleware to controller
exports.default = function (controller) {

	controller.middleware.receive.use(_index.wit.receive);
};
//# sourceMappingURL=receiveMiddleware.js.map