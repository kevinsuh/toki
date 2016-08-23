'use strict';
module.exports = function(sequelize, DataTypes) {
  var Session = sequelize.define('Session', {
    UserId: DataTypes.INTEGER,
    startTime: DataTypes.DATE,
    endTime: DataTypes.DATE,
    content: DataTypes.STRING,
    live: {  type: DataTypes.BOOLEAN,
             defaultValue: true
          },
    open: {  type: DataTypes.BOOLEAN,
             defaultValue: true
          }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        Session.belongsTo(models.User);
      }
    }
  });
  return Session;
};