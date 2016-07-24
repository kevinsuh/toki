'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.removeColumn('StoredWorkSessions', 'resumed');
  },

  down: function down(queryInterface, Sequelize) {

    // add open bool
    return queryInterface.addColumn('StoredWorkSessions', 'resumed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  }
};
//# sourceMappingURL=20160724181208-remove-resumed-from-storedworksession.js.map