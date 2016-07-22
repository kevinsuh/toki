'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add default breaktime
    return queryInterface.addColumn('Users', 'defaultBreakTime', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  down: function down(queryInterface, Sequelize) {
    return queryInterface.removeColumn('Users', 'defaultBreakTime');
  }
};
//# sourceMappingURL=20160722194214-add-default-break-time-touser.js.map