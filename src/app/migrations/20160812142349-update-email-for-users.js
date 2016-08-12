'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
   queryInterface.sequelize.query(
    'ALTER TABLE "Users" DROP CONSTRAINT email_unique_idx;'
   );
   queryInterface.removeIndex('Users', 'email_unique_idx');
   return;
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.changeColumn(
    'Users',
    'email',
    {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    })
  }
};
