'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add dontIncludeOthers bool
   queryInterface.addColumn(
      'Users',
      'pingTime',
      {
        type: Sequelize.TIME
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('Users', 'pingTime');

  }
};
