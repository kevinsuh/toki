'use strict';

var _botkit = require('botkit');

var _botkit2 = _interopRequireDefault(_botkit);

var _controllers = require('./bot/controllers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// config modules
require('dotenv').config();

// import the necessary things


var controller = _botkit2.default.slackbot();

var bot = controller.spawn({
  token: process.env.BOT_TOKEN
});

bot.startRTM(function (err) {
  if (!err) {
    console.log("RTM on and listening");
    (0, _controllers.customConfigBot)(controller);
  } else {
    console.log("RTM failed");
  }
});
//# sourceMappingURL=dev_slackbot.js.map