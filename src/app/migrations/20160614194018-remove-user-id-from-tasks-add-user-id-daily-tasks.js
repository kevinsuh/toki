'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // remove daily task columns from tasks table
   queryInterface.removeColumn('Tasks', 'UserId');

   return queryInterface.addColumn(
      'DailyTasks',
      'UserId',
      {
        type: Sequelize.INTEGER,
        references: 'Users',
        referencesKey: 'id'
      }
    );

  },

  down: function (queryInterface, Sequelize) {

    queryInterface.addColumn(
      'Tasks',
      'UserId',
      {
        type: Sequelize.INTEGER,
        references: 'Users',
        referencesKey: 'id'
      }
    );

   return queryInterface.removeColumn('DailyTasks', 'UserId');
  

  }
};
