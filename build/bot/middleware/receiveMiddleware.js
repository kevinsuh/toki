'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _index = require('../controllers/index');

// add receive middleware to controller

exports.default = function (controller) {

	controller.middleware.receive.use(_index.wit.receive);
};
//# sourceMappingURL=receiveMiddleware.js.map