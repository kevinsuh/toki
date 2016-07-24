'use strict';

module.exports = function (sequelize, DataTypes) {
  var StoredWorkSession = sequelize.define('StoredWorkSession', {
    workSessionId: DataTypes.INTEGER,
    minutes: DataTypes.DOUBLE
  }, {
    classMethods: {
      associate: function associate(models) {
        // associations can be defined here
        StoredWorkSession.belongsTo(models.WorkSession);
      }
    }
  });
  return StoredWorkSession;
};
//# sourceMappingURL=storedworksession.js.map