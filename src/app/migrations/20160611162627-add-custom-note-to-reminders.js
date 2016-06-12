'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add open bool
   queryInterface.addColumn(
      'Reminders',
      'customNote',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('Reminders', 'customNote');

  }
};
