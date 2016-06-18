'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add open bool
    queryInterface.addColumn('Reminders', 'customNote', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Reminders', 'customNote');
  }
};
//# sourceMappingURL=20160611162627-add-custom-note-to-reminders.js.map