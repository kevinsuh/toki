'use strict';

module.exports = function (sequelize, DataTypes) {
  var WorkSessionTask = sequelize.define('WorkSessionTask', {
    WorkSessionId: DataTypes.INTEGER,
    DailyTaskId: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
      }
    }
  });
  return WorkSessionTask;
};
//# sourceMappingURL=worksessiontask.js.map