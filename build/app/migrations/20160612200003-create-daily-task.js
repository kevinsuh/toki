'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {
    return queryInterface.createTable('DailyTasks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      TaskId: {
        type: Sequelize.INTEGER,
        references: { model: "Tasks", key: "id" }
      },
      priority: {
        type: Sequelize.INTEGER
      },
      minutes: {
        type: Sequelize.INTEGER
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
    return queryInterface.dropTable('DailyTasks');
  }
};
//# sourceMappingURL=20160612200003-create-daily-task.js.map