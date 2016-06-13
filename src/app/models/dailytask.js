'use strict';
module.exports = function(sequelize, DataTypes) {
  var DailyTask = sequelize.define('DailyTask', {
    priority: DataTypes.INTEGER,
    minutes: DataTypes.INTEGER,
    TaskId: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        DailyTask.belongsTo(models.Task);
        DailyTask.belongsToMany(models.WorkSession, { through: "WorkSessionTask" });
      }
    }
  });
  return DailyTask;
};