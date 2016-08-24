'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    return queryInterface.renameTable('Requests', 'Pings');
  },

  down: function down(queryInterface, Sequelize) {
    return queryInterface.renameTable('Pings', 'Requests');
  }
};
//# sourceMappingURL=20160824135007-change-request-to-ping.js.map