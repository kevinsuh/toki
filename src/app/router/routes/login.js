import request from 'request';
import express from 'express';

var router = express.Router();

// bring in helpers
import { getAuthAddress, startBot, saveUserOnLogin } from '../helpers';

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

        // identified user and check if oauth is valid
        var identity = JSON.parse(body);
        
        if (identity.ok) {

          // user has logged in
          console.log(`User has logged in. Now we must store that session on our server. Authenticate and Authorize the following user properly:`);
          console.log("User identity:");
          console.log(identity);
          console.log("Auth:");
          console.log(auth);

          saveUserOnLogin(auth, identity);

          // this is the message you send to user!!
          res.send("You have logged in!");

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