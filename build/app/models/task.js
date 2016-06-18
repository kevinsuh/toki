'use strict';

module.exports = function (sequelize, DataTypes) {
  var Task = sequelize.define('Task', {
    text: DataTypes.STRING,
    done: { type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
        Task.hasMany(models.DailyTask);
      }
    }
  });
  return Task;
};
//# sourceMappingURL=task.js.map