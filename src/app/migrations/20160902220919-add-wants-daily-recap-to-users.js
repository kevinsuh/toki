'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

  return queryInterface.addColumn(
    'Users',
    'wantsDailyRecap',
    {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    }
  );

},
down: function (queryInterface, Sequelize) {
   
   return queryInterface.removeColumn('Users', 'wantsDailyRecap');

  }
};

