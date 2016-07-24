'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.renameColumn('StoredWorkSessions', 'workSessionId', 'WorkSessionId');
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.renameColumn('StoredWorkSessions', 'WorkSessionId', 'workSessionId');
  }
};
//# sourceMappingURL=20160724045352-change-work-session-id-name.js.map