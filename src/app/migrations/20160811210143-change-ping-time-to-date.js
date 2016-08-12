'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

  queryInterface.removeColumn('Users', 'pingTime');
  return queryInterface.addColumn(
    'Users',
    'pingTime',
    {
      type: Sequelize.DATE
    }
  );

},
down: function (queryInterface, Sequelize) {
   queryInterface.removeColumn('Users', 'pingTime');
   return queryInterface.addColumn(
    'Users',
    'pingTime',
    {
      type: Sequelize.TIME
    }
  );

  }
};

