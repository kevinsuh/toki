'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add user reference to session groups
   return queryInterface.addColumn(
      'SessionGroups',
      'reflection',
      {
        type: Sequelize.TEXT
      }
    );

  },

  down: function (queryInterface, Sequelize) {

    // remove user reference
   return queryInterface.removeColumn('SessionGroups', 'reflection');
  

  }
};
