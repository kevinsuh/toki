'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // remove daily task columns from tasks table
   return queryInterface.removeColumn('Teams', 'BotId');

  },

  down: function (queryInterface, Sequelize) {

    return queryInterface.addColumn(
      'Teams',
      'BotId',
      {
        type: Sequelize.STRING
      }
    );
  

  }
};
