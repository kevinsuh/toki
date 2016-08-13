'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

  return queryInterface.addColumn(
    'Users',
    'onboarded',
    {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  );

},
down: function (queryInterface, Sequelize) {
   
   return queryInterface.removeColumn('Users', 'onboarded');

  }
};

