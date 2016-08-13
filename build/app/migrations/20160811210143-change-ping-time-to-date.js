'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    queryInterface.removeColumn('Users', 'pingTime');
    return queryInterface.addColumn('Users', 'pingTime', {
      type: Sequelize.DATE
    });
  },
  down: function down(queryInterface, Sequelize) {
    queryInterface.removeColumn('Users', 'pingTime');
    return queryInterface.addColumn('Users', 'pingTime', {
      type: Sequelize.TIME
    });
  }
};
//# sourceMappingURL=20160811210143-change-ping-time-to-date.js.map