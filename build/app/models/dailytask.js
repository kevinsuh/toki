'use strict';

module.exports = function (sequelize, DataTypes) {
  var DailyTask = sequelize.define('DailyTask', {
    priority: DataTypes.INTEGER,
    minutes: DataTypes.INTEGER,
    TaskId: DataTypes.INTEGER,
    type: { type: DataTypes.STRING,
      defaultValue: "live"
    },
    minutesSpent: { type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    classMethods: {
      associate: function associate(models) {
        DailyTask.belongsTo(models.Task);
        DailyTask.belongsTo(models.User);
        DailyTask.belongsToMany(models.WorkSession, { through: "WorkSessionTask" });
        DailyTask.hasMany(models.Reminder);
      }
    }
  });
  return DailyTask;
};
//# sourceMappingURL=dailytask.js.map