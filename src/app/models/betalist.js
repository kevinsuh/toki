'use strict';
module.exports = function(sequelize, DataTypes) {
  var BetaList = sequelize.define('BetaList', {
    email: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return BetaList;
};