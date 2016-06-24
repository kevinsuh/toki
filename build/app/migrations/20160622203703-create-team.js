'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    return queryInterface.createTable('Teams', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      TeamId: {
        type: Sequelize.STRING
      },
      BotId: {
        type: Sequelize.STRING
      },
      createdBy: {
        type: Sequelize.STRING
      },
      url: {
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING
      },
      token: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: function down(queryInterface, Sequelize) {
    return queryInterface.dropTable('Teams');
  }
};
//# sourceMappingURL=20160622203703-create-team.js.map