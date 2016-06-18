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


// new user creation - redirect from Slack
// 1. use returned OAuth Code and send back w/ client_id and secret
// 2. authenticate install w/ returned token
// 3. start bot and initiate the conversation
router.get('/', function (req, res) {

  console.log("STARTING TEAM REGISTRATION...");

  // temp authorization code
  var authCode = req.query.code;

  if (!authCode) {
    // user refused auth
    res.redirect('/');
  } else {
    console.log('New user with auth code: ' + authCode);
    install(authCode, res);
  }
});

// for when you are first creating slack app
var install = function install(authCode, res) {
  var authAddress = (0, _helpers.getAuthAddress)(authCode, "new");
  _request2.default.get(authAddress, function (error, response, body) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
    } else {
      var auth = JSON.parse(body);
      console.log("New user auth");
      console.log(auth);
      registerTeam(auth, res);
    }
  });
};

// after getting access token...
// first time => register
var registerTeam = function registerTeam(auth, res) {
  //first, get authenticating user ID
  var url = 'https://slack.com/api/auth.test?';
  url += 'token=' + auth.access_token;

  _request2.default.get(url, function (error, response, body) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
    } else {
      try {
        var identity = JSON.parse(body);
        console.log(identity);

        var team = {
          id: identity.team_id,
          bot: {
            token: auth.bot.bot_access_token,
            user_id: auth.bot.bot_user_id,
            createdBy: identity.user_id
          },
          createdBy: identity.user_id,
          url: identity.url,
          name: identity.team
        };

        console.log("\n\n\n ~~ bot has been installed ~~ \n\n\n");
        console.log(team);
        // start the bot!
        (0, _helpers.startBot)(team, "create");

        // user has signed up
        console.log('User has logged in. Now we must store that session on our server. Authenticate and Authorize the following user properly:');
        console.log("User identity:");
        console.log(identity);
        console.log("Auth:");
        console.log(auth);
        console.log("Team:");
        console.log(team);

        res.send("Your bot has been installed");

        // this isnt working for some reason
        (0, _helpers.saveUser)(auth, team);
      } catch (e) {
        console.log(e);
      }
    }
  });
};

exports.default = router;
//# sourceMappingURL=signup.js.map