'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // remove type from reminders
    return queryInterface.removeColumn('Reminders', 'type');
  },

  down: function down(queryInterface, Sequelize) {

    // add type to reminders
    return queryInterface.addColumn('Reminders', 'type', {
      type: Sequelize.STRING
    });
  }
};
//# sourceMappingURL=20160613212318-remove-type-from-reminder.js.map