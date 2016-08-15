'use strict';
module.exports = function(sequelize, DataTypes) {
  var Include = sequelize.define('Include', {
    IncluderSlackUserId: DataTypes.STRING,
    IncludedSlackUserId: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Include;
};