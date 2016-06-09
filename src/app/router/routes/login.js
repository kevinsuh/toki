import request from 'request';

import express from 'express';
var router = express.Router();

// bring in helpers
import { getAuthAddress, startBot, saveUser } from '../helpers';

// sign in with slack -- redirect from slack
// 1. use returned OAuth Code and send back w/ client_id and secret
// 2. verify user w/ returned token
// 3. start bot and initiate the conversation
router.get('/', (req, res) => {

  console.log("STARTING TEAM LOGIN...");

  // temp authorization code
  var authCode = req.query.code;

  if (!authCode) {
    // user refused auth
    res.redirect('/');
  } else {
    console.log (`Logging in user with auth code: ${authCode}`);
    login(authCode, res);
  }

});

// for subsequent logins
var login = (authCode, res) => {

  var authAddress = getAuthAddress(authCode, "login");

  request.get(authAddress, function (error, response, body) {
    if (error){
      console.log(error)
      res.sendStatus(500)
    } else {
      var auth = JSON.parse(body)
      console.log("User login auth")
      console.log(auth)
      authenticateTeam(auth,res)
    }
  });
}

// after getting access token...
// subsequent times => authenticate
var authenticateTeam = (auth, res) => {

  // you have bot access_token now
  // use this to identify the user
  var url = 'https://slack.com/api/users.identity?';
  url += 'token=' + auth.access_token;

  console.log("in authenticate team");
  console.log(url);

  request.get(url, (error, response, body) => {
    
    console.log("in identify user call");

    if (error) {
      console.log(error);
      res.sendStatus(500);
    } else {
      try {
        console.log("identified user");
        var identity = JSON.parse(body);
        // if identity is true, then activate the bot
        if (identity.ok) {
          var team = {
            id: identity.team.id,
            bot:{
              token: auth.bot.bot_access_token,
              user_id: auth.bot.bot_user_id,
              createdBy: identity.user.id
            },
            createdBy: identity.user.id,
            name: identity.user.name
          }
          console.log(team);
          startBot(team, "login");
          res.send("You have logged in!");
          saveUser(auth, team)
        } else {
          res.send("Sorry! Please try again");
        }

      } catch(e) {
        console.log(e);
      }
    }

  })

}

export default router;