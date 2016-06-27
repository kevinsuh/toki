'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAuthAddress = getAuthAddress;
exports.startBot = startBot;
exports.saveUserOnRegistration = saveUserOnRegistration;
exports.saveUserOnLogin = saveUserOnLogin;

var _controllers = require('../../bot/controllers');

function getAuthAddress(authCode, uri_path) {
  //post code, app ID, and app secret, to get token
  var authAddress = 'https://slack.com/api/oauth.access?';
  authAddress += 'client_id=' + process.env.SLACK_ID;
  authAddress += '&client_secret=' + process.env.SLACK_SECRET;
  authAddress += '&code=' + authCode;
  authAddress += '&redirect_uri=' + process.env.SLACK_REDIRECT + uri_path;
  return authAddress;
}

function startBot(team, type) {
  console.log(team.name + " start bot");
  console.log(team);
  if (type == 'login') {
    (0, _controllers.connectOnLogin)(team);
  } else if (type == 'create') {
    (0, _controllers.connectOnInstall)(team);
  }
}

// on register team
function saveUserOnRegistration(auth, identity) {

  _controllers.controller.storage.users.get(identity.user_id, function (err, user) {

    var isnew = user ? false : true;
    // data from slack API to create or update our DB with
    user = {
      id: identity.user_id,
      access_token: auth.access_token,
      scopes: auth.scope,
      team_id: identity.team_id,
      user: identity.user
    };

    _controllers.controller.storage.users.save(user, function (err, id) {
      if (err) {
        console.log('An error occurred while saving a user: ', err);
        _controllers.controller.trigger('error', [err]);
      } else {
        if (isnew) {
          console.log("New user " + id.toString() + " saved");
        } else {
          console.log("User " + id.toString() + " updated");
        }
        console.log("================== END TEAM REGISTRATION ==================");
      }
    });
  });
}

// on login
function saveUserOnLogin(auth, identity) {

  _controllers.controller.storage.users.get(identity.user.id, function (err, user) {

    var isnew = user ? false : true;
    // data from slack API to create or update our DB with
    user = {
      id: identity.user.id,
      access_token: auth.access_token,
      scopes: auth.scope,
      team_id: identity.team.id,
      user: identity.user.name
    };

    _controllers.controller.storage.users.save(user, function (err, id) {
      if (err) {
        console.log('An error occurred while saving a user: ', err);
        _controllers.controller.trigger('error', [err]);
      } else {
        if (isnew) {
          console.log("New user " + id.toString() + " saved");
        } else {
          console.log("User " + id.toString() + " updated");
        }
        console.log("================== END TEAM REGISTRATION ==================");
      }
    });
  });
}
//# sourceMappingURL=helpers.js.map