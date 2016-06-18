'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    // add open bool
    queryInterface.addColumn('Users', 'nickName', {
      type: Sequelize.STRING
    });
  },

  down: function down(queryInterface, Sequelize) {

    return queryInterface.removeColumn('Users', 'nickName');
  }
};
//# sourceMappingURL=20160611195237-add-nickname-to-users.js.map