'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
    // make NOT NULL
    return queryInterface.changeColumn(
      'Tasks',
      'done',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }
    );

  },

  down: function (queryInterface, Sequelize) {
    
  }
};
