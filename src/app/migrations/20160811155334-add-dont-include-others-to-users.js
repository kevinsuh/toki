'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add dontIncludeOthers bool
   queryInterface.addColumn(
      'Users',
      'dontIncludeOthers',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('Users', 'dontIncludeOthers');

  }
};
