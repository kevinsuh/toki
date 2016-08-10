'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add wonDay bool
   queryInterface.addColumn(
      'SessionGroups',
      'wonDay',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('SessionGroups', 'wonDay');

  }
};
