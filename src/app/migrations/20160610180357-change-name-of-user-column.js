'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('Tasks','userId','UserId');

  },

  down: function (queryInterface, Sequelize) {
    
    return queryInterface.renameColumn('Tasks','UserId', 'userId');

  }
};
