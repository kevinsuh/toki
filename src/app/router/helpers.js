import { connectOnLogin, connectOnInstall } from '../../bot/controllers';
import { controller as slack } from '../../bot/controllers';

export function getAuthAddress(authCode, uri_path) {
  //post code, app ID, and app secret, to get token
  var authAddress = 'https://slack.com/api/oauth.access?'
  authAddress += 'client_id=' + process.env.SLACK_ID
  authAddress += '&client_secret=' + process.env.SLACK_SECRET
  authAddress += '&code=' + authCode
  authAddress += '&redirect_uri=' + process.env.SLACK_REDIRECT + uri_path;
  return authAddress;
}

export function startBot(team, type) {
  console.log(team.name + " start bot")
  console.log(team);
  if (type == 'login') {
    connectOnLogin(team)
  } else if (type == 'create') {
    connectOnInstall(team)
  }
}

export function saveUser(auth, identity) {

  // what scopes did we get approved for?
  var scopes = auth.scope.split(/\,/);

  slack.controller.storage.users.get(identity.user_id, function(err, user) {
    isnew = false;
    if (!user) {
        isnew = true;
        user = {
            id: identity.user_id,
            access_token: auth.access_token,
            scopes: scopes,
            team_id: identity.team_id,
            user: identity.user,
        };
    }
    slack.controller.storage.users.save(user, function(err, id) {
      if (err) {
        console.log('An error occurred while saving a user: ', err);
        slack.controller.trigger('error', [err]);
      }
      else {
        if (isnew) {
          console.log("New user " + id.toString() + " saved");
        }
        else {
          console.log("User " + id.toString() + " updated");
        }
        console.log("================== END TEAM REGISTRATION ==================")
      }
    });
  });
}