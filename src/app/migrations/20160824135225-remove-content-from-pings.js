'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // remove daily task columns from tasks table
   return queryInterface.removeColumn('Pings', 'content');

  },

  down: function (queryInterface, Sequelize) {

    return queryInterface.addColumn(
      'Pings',
      'content',
      {
        type: Sequelize.STRING
      }
    );
  

  }
};
