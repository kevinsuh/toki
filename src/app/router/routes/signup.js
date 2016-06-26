import request from 'request';
import express from 'express';

var router = express.Router();

// bring in helpers
import { getAuthAddress, startBot, saveUser } from '../helpers';

// new user creation - redirect from Slack
// 1. use returned OAuth Code and send back w/ client_id and secret
// 2. authenticate install w/ returned token
// 3. start bot and initiate the conversation
router.get('/', (req, res) => {

  console.log("STARTING TEAM REGISTRATION...");

  // temp authorization code
  var authCode = req.query.code;

  if (!authCode) {
    // user refused auth
    res.redirect('/');
  } else {
    console.log (`New user with auth code: ${authCode}`);
    install(authCode, res);
  }

});

// for when you are first creating slack app
var install = (authCode, res) => {
  var authAddress = getAuthAddress(authCode, "new");
  request.get(authAddress, function (error, response, body) {
    if (error){
      console.log(error)
      res.sendStatus(500)
    } else {
      var auth = JSON.parse(body)
      console.log("New user auth")
      console.log(auth)
      registerTeam(auth,res)
    }
  });
}

// after getting access token...
// first time => register
var registerTeam = (auth, res) => {
  //first, get authenticating user ID
  var url = 'https://slack.com/api/auth.test?'
  url += 'token=' + auth.access_token

  request.get(url, (error, response, body) =>{
    if (error){
      console.log(error)
      res.sendStatus(500)
    } else {
      try {
        var identity = JSON.parse(body)
        console.log(identity)

        var team = {
          id: identity.team_id,
          bot:{
            token: auth.bot.bot_access_token,
            user_id: auth.bot.bot_user_id,
            createdBy: identity.user_id
          },
          createdBy: identity.user_id,
          url: identity.url,
          name: identity.team
        }

        // start the bot!
        startBot(team, "create");

        // user has signed up
        console.log(`User has logged in. Now we must store that session on our server. Authenticate and Authorize the following user properly:`);
        console.log("User identity:");
        console.log(identity);
        console.log("Auth:");
        console.log(auth);
        console.log("Team:");
        console.log(team);

        res.send("Your bot has been installed");

        // this isnt working for some reason
        saveUser(auth, identity);
      } catch(e){
        console.log(e);
      }
    }
  })
}

export default router;