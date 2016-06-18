'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _helpers = require('../helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

// bring in helpers


// sign in with slack -- redirect from slack
// 1. use returned OAuth Code and send back w/ client_id and secret
// 2. verify user w/ returned token
// 3. start bot and initiate the conversation
router.get('/', function (req, res) {

  console.log("STARTING TEAM LOGIN...");

  // temp authorization code
  var authCode = req.query.code;

  if (!authCode) {
    // user refused auth
    res.redirect('/');
  } else {
    console.log('Logging in user with auth code: ' + authCode);
    login(authCode, res);
  }
});

// for subsequent logins
var login = function login(authCode, res) {

  var authAddress = (0, _helpers.getAuthAddress)(authCode, "login");

  _request2.default.get(authAddress, function (error, response, body) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
    } else {
      var auth = JSON.parse(body);
      console.log("User login auth");
      console.log(auth);
      authenticateTeam(auth, res);
    }
  });
};

// after getting access token...
// subsequent times => authenticate
var authenticateTeam = function authenticateTeam(auth, res) {

  // you have bot access_token now
  // use this to identify the user
  var url = 'https://slack.com/api/users.identity?';
  url += 'token=' + auth.access_token;

  console.log("in authenticate team");
  console.log(url);

  _request2.default.get(url, function (error, response, body) {

    console.log("in identify user call");

    if (error) {
      console.log(error);
      res.sendStatus(500);
    } else {
      try {

        console.log("identified user");
        var identity = JSON.parse(body);
        console.log(identity);

        // if identity is true, then activate the bot
        // this is not valid. activating bot cannot be done by logging in -- you can still provide functionality but it must be via user_id and team_id, and slack SSO is not meant for everyone to have access to your bot
        if (identity.ok) {
          res.send("You have logged in!");
        }

        // this code can be used later (for an "wake up Navi" button)
        if (false) {
          if (identity.ok) {
            var team = {
              id: identity.team.id,
              bot: {
                token: auth.bot.bot_access_token,
                user_id: auth.bot.bot_user_id,
                createdBy: identity.user.id
              },
              createdBy: identity.user.id,
              name: identity.user.name
            };
            // start the bot!
            (0, _helpers.startBot)(team, "login");

            // user has logged in
            console.log('User has logged in. Now we must store that session on our server. Authenticate and Authorize the following user properly:');
            console.log("User identity:");
            console.log(identity);
            console.log("Auth:");
            console.log(auth);
            console.log("Team:");
            console.log(team);

            res.send("You have logged in!");
            (0, _helpers.saveUser)(auth, team);
          } else {
            res.send("Sorry! Please try again");
          }
        }
      } catch (e) {
        console.log(e);
      }
    }
  });
};

exports.default = router;
//# sourceMappingURL=login.js.map