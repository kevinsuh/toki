'use strict';

module.exports = {

  up: function up(queryInterface, Sequelize) {

    return queryInterface.addColumn('Sessions', 'superFocus', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },
  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Sessions', 'superFocus');
  }
};
//# sourceMappingURL=20160827220640-add-super-focus-to-session.js.map