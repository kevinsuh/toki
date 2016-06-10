'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    
    // make NOT NULL
    return queryInterface.changeColumn(
      'SlackUsers',
      'SlackUserId',
      {
        type: Sequelize.STRING,
        allowNull: false
      }
    );

  },

  down: function (queryInterface, Sequelize) {
    
  }
};
