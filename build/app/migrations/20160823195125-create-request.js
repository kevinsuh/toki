'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    return queryInterface.createTable('Requests', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      FromUserId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" }
      },
      ToUserId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "id" }
      },
      content: {
        type: Sequelize.STRING
      },
      type: {
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
    return queryInterface.dropTable('Requests');
  }
};
//# sourceMappingURL=20160823195125-create-request.js.map