'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add userID
   queryInterface.addColumn(
      'Tasks',
      'userID',
      {
        type: Sequelize.INTEGER,
        references: 'Users',
        referencesKey: 'id',
        allowNull: false
      }
    );

   // make email unique
   return queryInterface.changeColumn(
      'Users',
      'email',
      {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      }
    )

  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('Tasks', 'userID');

  }
};
