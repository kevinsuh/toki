'use strict';
module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    email: DataTypes.STRING,
    admin: { DataTypes.BOOLEAN,
             defaultValue: false
           }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        User.hasMany(models.Task);
      }
    }
  });
  return User;
};