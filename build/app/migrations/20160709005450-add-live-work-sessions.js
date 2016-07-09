'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add live to worksessions
    queryInterface.addColumn('WorkSessions', 'live', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('WorkSessions', 'live');
  }
};
//# sourceMappingURL=20160709005450-add-live-work-sessions.js.map