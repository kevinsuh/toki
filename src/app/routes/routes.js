import request from 'request';
import { connect } from '../controllers';
import controllerRoot from '../controllers';

export default (app) => {

  /**
   *    PUBLIC PAGES
   */
  // root
  app.get('/', (req, res) => {
    console.log("root");
    res.render('root');
  });

  // new user creation - redirect from Slack
  app.get('/new', (req, res) => {
    console.log("STARTING TEAM REGISTRATION");

    // temp authorization code
    var authCode = req.query.code;

    if (!authCode) {
      // user refused auth
      res.redirect('/');
    } else {
      console.log (`New user with auth code: ${authCode}`);
      performAuth(authCode, res);
    }

  })

  //CREATION ===================================================

  var performAuth = function(authCode, res) {
    //post code, app ID, and app secret, to get token
    var authAddress = 'https://slack.com/api/oauth.access?'
    authAddress += 'client_id=' + process.env.SLACK_ID
    authAddress += '&client_secret=' + process.env.SLACK_SECRET
    authAddress += '&code=' + authCode
    authAddress += '&redirect_uri=' + process.env.SLACK_REDIRECT + "new"

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
    })
  }

  var registerTeam = (auth, res) => {
    //first, get authenticating user ID
    var url = 'https://slack.com/api/auth.test?'
    url += 'token=' + auth.access_token

    request.get(url, function (error, response, body) {
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
          startBot(team)
          res.send("Your bot has been installed")

          saveUser(auth, identity)
        }
        catch(e){
          console.log(e)
        }
      }
    })
  }

  var startBot = (team) => {
    console.log(team.name + " start bot")

    connect(team)
  }

  var saveUser = function(auth, identity) {

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

}

