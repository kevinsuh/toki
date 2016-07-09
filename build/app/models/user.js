'use strict';

var _server = require('../../server');

var _controllers = require('../../bot/controllers');

'use strict';
module.exports = function (sequelize, DataTypes) {
  var User = sequelize.define('User', {
    email: DataTypes.STRING,
    admin: { type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    nickName: DataTypes.STRING,
    defaultSnoozeTime: DataTypes.INTEGER
  }, {

    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
        User.hasMany(models.DailyTask);
        User.hasOne(models.SlackUser, { foreignKey: 'UserId' });
        User.hasMany(models.Reminder);
        User.hasMany(models.WorkSession);
        User.hasMany(models.SessionGroup);
      }
    },

    instanceMethods: {}

  });
  return User;
};
//# sourceMappingURL=user.js.map