'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // remove daily task columns from tasks table
   queryInterface.removeColumn('Tasks', 'priority');

   return queryInterface.removeColumn('Tasks', 'minutes');

  },

  down: function (queryInterface, Sequelize) {

    // add priority and minutes
   queryInterface.addColumn(
      'Tasks',
      'priority',
      {
        type: Sequelize.INTEGER
      }
    );

   return queryInterface.addColumn(
      'Tasks',
      'minutes',
      {
        type: Sequelize.INTEGER
      }
    );
  

  }
};
