'use strict';
module.exports = function(sequelize, DataTypes) {
  var Reminder = sequelize.define('Reminder', {
    remindTime: DataTypes.DATE,
    UserId: DataTypes.INTEGER,
    customNote: DataTypes.STRING,
    open: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        Reminder.belongsTo(models.User);
      }
    }
  });
  return Reminder;
};