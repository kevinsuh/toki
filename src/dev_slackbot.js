import Botkit from 'botkit';

// config modules
require('dotenv').config();

// import the necessary things
import { customConfigBot } from './bot/controllers';

var controller = Botkit.slackbot();

var bot = controller.spawn({
    token: process.env.BOT_TOKEN
});

bot.startRTM((err) => {
  if (!err) {
    console.log("RTM on and listening");
    customConfigBot(controller);
  } else {
    console.log("RTM failed")
  }
});

