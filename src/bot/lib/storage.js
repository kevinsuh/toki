// custom storage system to use Sequelize
// and have it integrated properly with botkit

import models from '../../app/models';

export default function(config) {

	if (!config) {
		config = {
			path: './'
		};
	}

	var objectsToList = (cb) => {
		return (err, data) => {
			if (err) {
				cb(err, data);
			} else {
				cb(err, )
			}
		}
	}



}

var storage = {
	teams: {
		get: (teamId, cb) => {

		},
		save: (teamData, cb) => {

		},
		all: (cb) => {

		}
	},
	users: {
		get: (userId, cb) => {

		},
		save: (userData, cb) => {

		},
		all: (cb) => {

		}
	},
	channels: {
		get: (userId, cb) => {

		},
		save: (channelData, cb) => {

		},
		all: (cb) => {

		}
	}
}

