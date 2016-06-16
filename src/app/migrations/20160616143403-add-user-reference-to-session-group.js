'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add user reference to session groups
   return queryInterface.addColumn(
      'SessionGroups',
      'UserId',
      {
        type: Sequelize.INTEGER,
        references: 'Users',
        referencesKey: 'id'
      }
    );

  },

  down: function (queryInterface, Sequelize) {

    // remove user reference
   return queryInterface.removeColumn('SessionGroups', 'UserId');
  

  }
};
