'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {

  queryInterface.removeColumn('Users', 'dontIncludeOthers');
  queryInterface.addColumn(
    'Users',
    'includeOthersDecision',
    {
      type: Sequelize.STRING,
      defaultValue: "default"
    }
  );

},
down: function (queryInterface, Sequelize) {
   // add dontIncludeOthers bool
   queryInterface.addColumn(
      'Users',
      'dontIncludeOthers',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    );
   return queryInterface.removeColumn('Users', 'includeOthersDecision');

  }
};

