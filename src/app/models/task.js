'use strict';
module.exports = function(sequelize, DataTypes) {
  var Task = sequelize.define('Task', {
    text: DataTypes.STRING,
    done: {  type: DataTypes.BOOLEAN,
             defaultValue: false
          },
    priority: DataTypes.INTEGER,
    minutes: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        Task.belongsTo(models.User);
      }
    }
  });
  return Task;
};