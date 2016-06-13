'use strict';
module.exports = function(sequelize, DataTypes) {
  var WorkSession = sequelize.define('WorkSession', {
    startTime: DataTypes.DATE,
    endTime: DataTypes.DATE,
    User: DataTypes.REFERENCES,
    WorkSessionTask: DataTypes.REFERENCES
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return WorkSession;
};