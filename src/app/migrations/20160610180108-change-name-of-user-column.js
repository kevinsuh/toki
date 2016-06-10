'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('Tasks','userID','userId');

  },

  down: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('Tasks','userId','userID');

  }
};
