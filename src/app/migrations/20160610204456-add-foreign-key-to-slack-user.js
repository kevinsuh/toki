'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    // make UserId foreign key
   queryInterface.changeColumn(
      'SlackUsers',
      'UserId',
      {
        type: Sequelize.INTEGER,
        references: {
          model: "Users",
          key: "id"
        }
      }
    );
  },

  down: function (queryInterface, Sequelize) {
    done();
  }
};