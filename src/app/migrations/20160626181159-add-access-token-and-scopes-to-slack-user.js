'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

    // add scopes
   queryInterface.addColumn(
      'SlackUsers',
      'scopes',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    );

   // add access token
   return queryInterface.addColumn(
      'SlackUsers',
      'accessToken',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    );

  },

  down: function (queryInterface, Sequelize) {
    queryInterface.removeColumn('SlackUsers', 'scopes');
    return queryInterface.removeColumn('SlackUsers', 'accessToken');
  }
};
