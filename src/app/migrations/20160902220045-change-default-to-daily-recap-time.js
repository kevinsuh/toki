'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

  queryInterface.removeColumn('Users', 'dailyRecapTime');
  return queryInterface.addColumn(
    'Users',
    'dailyRecapTime',
    {
      type: Sequelize.DATE
    }
  );

},
down: function (queryInterface, Sequelize) {
   queryInterface.removeColumn('Users', 'dailyRecapTime');
   return queryInterface.addColumn(
    'Users',
    'dailyRecapTime',
    {
      type: Sequelize.TIME
    }
  );

  }
};

