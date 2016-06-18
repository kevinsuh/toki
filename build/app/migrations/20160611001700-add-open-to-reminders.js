'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add open bool
    queryInterface.addColumn('Reminders', 'open', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Reminders', 'open');
  }
};
//# sourceMappingURL=20160611001700-add-open-to-reminders.js.map