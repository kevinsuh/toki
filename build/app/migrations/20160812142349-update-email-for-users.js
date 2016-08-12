'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    queryInterface.sequelize.query('ALTER TABLE "Users" DROP CONSTRAINT email_unique_idx;');
    queryInterface.removeIndex('Users', 'email_unique_idx');
    return;
  },

  down: function down(queryInterface, Sequelize) {
    return queryInterface.changeColumn('Users', 'email', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    });
  }
};
//# sourceMappingURL=20160812142349-update-email-for-users.js.map