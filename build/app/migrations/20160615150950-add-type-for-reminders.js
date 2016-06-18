'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add type to reminders
    return queryInterface.addColumn('Reminders', 'type', {
      type: Sequelize.STRING
    });
  },

  down: function down(queryInterface, Sequelize) {

    // remove type from reminders
    return queryInterface.removeColumn('Reminders', 'type');
  }
};
//# sourceMappingURL=20160615150950-add-type-for-reminders.js.map