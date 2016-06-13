'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // remove type from reminders
   return queryInterface.removeColumn('Reminders', 'type');

  },

  down: function (queryInterface, Sequelize) {

    // add type to reminders
   return queryInterface.addColumn(
      'Reminders',
      'type',
      {
        type: Sequelize.STRING
      }
    );

  }
};
