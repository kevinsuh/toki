'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.addColumn(
      'Teams',
      'scopes',
      {
        type: Sequelize.STRING
      }
    );

    return queryInterface.addColumn(
      'Teams',
      'accessToken',
      {
        type: Sequelize.STRING
      }
    );
  },

  down: function (queryInterface, Sequelize) {
    
    queryInterface.removeColumn('Teams', 'scopes');
    return queryInterface.removeColumn('Teams', 'accessToken');
  }
};
