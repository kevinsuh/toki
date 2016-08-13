'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    return queryInterface.addColumn('Users', 'wantsPing', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  },
  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'wantsPing');
  }
};
//# sourceMappingURL=20160811210731-add-wants-ping-to-users.js.map