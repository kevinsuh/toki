'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add wonDay bool
    queryInterface.addColumn('SessionGroups', 'wonDay', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('SessionGroups', 'wonDay');
  }
};
//# sourceMappingURL=20160810181122-add-won-day-to-session-group.js.map