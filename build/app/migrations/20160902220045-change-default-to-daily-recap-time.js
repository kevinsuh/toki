'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    queryInterface.removeColumn('Users', 'dailyRecapTime');
    return queryInterface.addColumn('Users', 'dailyRecapTime', {
      type: Sequelize.DATE
    });
  },
  down: function down(queryInterface, Sequelize) {
    queryInterface.removeColumn('Users', 'dailyRecapTime');
    return queryInterface.addColumn('Users', 'dailyRecapTime', {
      type: Sequelize.TIME
    });
  }
};
//# sourceMappingURL=20160902220045-change-default-to-daily-recap-time.js.map