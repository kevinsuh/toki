'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

   // add open bool
   queryInterface.addColumn(
      'Users',
      'nickName',
      {
        type: Sequelize.STRING
      }
    );
  },

  down: function (queryInterface, Sequelize) {
 
   return queryInterface.removeColumn('Users', 'nickName');

  }
};
