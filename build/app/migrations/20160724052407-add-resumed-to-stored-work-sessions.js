'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add open bool
    return queryInterface.addColumn('StoredWorkSessions', 'resumed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('StoredWorkSessions', 'resumed');
  }
};
//# sourceMappingURL=20160724052407-add-resumed-to-stored-work-sessions.js.map