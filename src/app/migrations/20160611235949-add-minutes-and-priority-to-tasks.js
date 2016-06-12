'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

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


  },

  down: function (queryInterface, Sequelize) {
  
   queryInterface.removeColumn('Tasks', 'priority');

   return queryInterface.removeColumn('Tasks', 'minutes');

  }
};
