'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add dontIncludeOthers bool
    queryInterface.addColumn('Users', 'dailyRecapTime', {
      type: Sequelize.TIME
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'dailyRecapTime');
  }
};
//# sourceMappingURL=20160902215932-add-daily-recap-time-to-users.js.map