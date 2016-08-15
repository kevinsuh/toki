'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'onboarded');
  },
  down: function down(queryInterface, Sequelize) {

    return queryInterface.addColumn('Users', 'onboarded', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  }
};
//# sourceMappingURL=20160815222212-remove-onboarded-from-user.js.map