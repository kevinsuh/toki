'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.addColumn('Users', 'wantsDailyRecap', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  },
  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'wantsDailyRecap');
  }
};
//# sourceMappingURL=20160902220919-add-wants-daily-recap-to-users.js.map