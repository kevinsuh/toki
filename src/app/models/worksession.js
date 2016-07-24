'use strict';
module.exports = function(sequelize, DataTypes) {
  var WorkSession = sequelize.define('WorkSession', {
    startTime: DataTypes.DATE,
    endTime: DataTypes.DATE,
    UserId: DataTypes.INTEGER,
    open: DataTypes.BOOLEAN,
    live: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        WorkSession.belongsToMany(models.DailyTask, { through: "WorkSessionTask"} );
        WorkSession.belongsTo(models.User);
        WorkSession.hasMany(models.StoredWorkSession);
      }
    }
  });
  return WorkSession;
};