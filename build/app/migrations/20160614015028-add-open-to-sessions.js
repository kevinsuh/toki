'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add open bool
    queryInterface.addColumn('WorkSessions', 'open', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('WorkSessions', 'open');
  }
};
//# sourceMappingURL=20160614015028-add-open-to-sessions.js.map