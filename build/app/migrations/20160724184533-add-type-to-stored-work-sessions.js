'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add open bool
    return queryInterface.addColumn('StoredWorkSessions', 'live', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('StoredWorkSessions', 'live');
  }
};
//# sourceMappingURL=20160724184533-add-type-to-stored-work-sessions.js.map