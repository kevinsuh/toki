'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add default snooze
    return queryInterface.addColumn('Users', 'defaultSnoozeTime', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  down: function down(queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'defaultSnoozeTime');
  }
};
//# sourceMappingURL=20160708154157-add-default-snooze-to-users.js.map