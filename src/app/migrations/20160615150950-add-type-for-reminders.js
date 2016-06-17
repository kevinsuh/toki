'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add type to reminders
   return queryInterface.addColumn(
      'Reminders',
      'type',
      {
        type: Sequelize.STRING
      }
    );

  },

  down: function (queryInterface, Sequelize) {

   // remove type from reminders
   return queryInterface.removeColumn('Reminders', 'type');

  }
};
