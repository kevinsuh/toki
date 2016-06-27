'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    // add user reference to session groups
   return queryInterface.addColumn(
      'SlackUsers',
      'TeamId',
      {
        type: Sequelize.STRING
      }
    );
  },

  down: function (queryInterface, Sequelize) {
   return queryInterface.removeColumn('SlackUsers', 'TeamId');
  }
};
