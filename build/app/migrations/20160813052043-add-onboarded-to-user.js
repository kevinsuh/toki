'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.addColumn('Users', 'onboarded', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },
  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'onboarded');
  }
};
//# sourceMappingURL=20160813052043-add-onboarded-to-user.js.map