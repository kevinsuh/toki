'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

  queryInterface.changeColumn(
    'Users',
    'email',
    {
      type: Sequelize.STRING,
      allowNull: false,
      unique: false,
      defaultValue: ""
    }
  )

  return queryInterface.addColumn(
    'SlackUsers',
    'SlackName',
    {
      type: Sequelize.STRING
    }
  );

},
down: function (queryInterface, Sequelize) {

    queryInterface.changeColumn(
    'Users',
    'email',
    {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    }
  )
   
   return queryInterface.removeColumn('SlackUsers', 'SlackName');

  }
};

