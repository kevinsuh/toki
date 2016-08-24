'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.addColumn('Pings', 'pingTime', {
      type: Sequelize.DATE
    });
  },
  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'pingTime');
  }
};
//# sourceMappingURL=20160824190651-add-ping-time-to-ping.js.map