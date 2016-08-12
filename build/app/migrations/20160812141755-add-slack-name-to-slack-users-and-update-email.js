'use strict';

module.exports = {
  up: function up(queryInterface, Sequelize) {

    queryInterface.changeColumn('Users', 'email', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: false,
      defaultValue: ""
    });

    return queryInterface.addColumn('SlackUsers', 'SlackName', {
      type: Sequelize.STRING
    });
  },
  down: function down(queryInterface, Sequelize) {

    queryInterface.changeColumn('Users', 'email', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    });

    return queryInterface.removeColumn('SlackUsers', 'SlackName');
  }
};
//# sourceMappingURL=20160812141755-add-slack-name-to-slack-users-and-update-email.js.map