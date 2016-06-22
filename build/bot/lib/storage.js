'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (config) {

	if (!config) {
		config = {
			path: './'
		};
	}

	var objectsToList = function objectsToList(cb) {
		return function (err, data) {
			if (err) {
				cb(err, data);
			} else {
				cb(err);
			}
		};
	};
};

var _models = require('../../app/models');

var _models2 = _interopRequireDefault(_models);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// custom storage system to use Sequelize
// and have it integrated properly with botkit

var storage = {
	teams: {
		get: function get(teamId, cb) {},
		save: function save(teamData, cb) {},
		all: function all(cb) {}
	},
	users: {
		get: function get(userId, cb) {},
		save: function save(userData, cb) {},
		all: function all(cb) {}
	},
	channels: {
		get: function get(userId, cb) {},
		save: function save(channelData, cb) {},
		all: function all(cb) {}
	}
};
//# sourceMappingURL=storage.js.map