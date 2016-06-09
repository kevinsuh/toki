import request from 'request';
import { connectOnInstall, connectOnLogin } from '../controllers';
import { controller as slack } from '../controllers';

export default (app) => {

  /**
   *    PUBLIC PAGES
   */
  // root
  app.get('/', (req, res) => {
    res.render('root');
  });

  // new user creation - redirect from Slack
  app.get('/new', (req, res) => {

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

  // sign in with slack -- redirect from slack
  app.get('/login', (req, res) => {

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

  var getAuthAddress = (authCode, uri_path) => {
    //post code, app ID, and app secret, to get token
    var authAddress = 'https://slack.com/api/oauth.access?'
    authAddress += 'client_id=' + process.env.SLACK_ID
    authAddress += '&client_secret=' + process.env.SLACK_SECRET
    authAddress += '&code=' + authCode
    authAddress += '&redirect_uri=' + process.env.SLACK_REDIRECT + uri_path;
    return authAddress;
  }

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
          startBot(team, "create");
          res.send("Your bot has been installed");

          // this isnt working for some reason
          saveUser(auth, team)
        } catch(e){
          console.log(e);
        }
      }
    })
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

  // res object
  //   { ok: true,
  // access_token: 'xoxp-36063701207-36062318368-49265805603-a7272b3e67',
  // scope: 'identify,bot',
  // user_id: 'U121U9CAU',
  // team_name: 'Navi',
  // team_id: 'T121VLM63',
  // bot:
  //  { bot_user_id: 'U1F8T3HB6',
  //    bot_access_token: 'xoxb-49299119380-L5QGhw29PRlAtpL3avh9DxTC' } }

  }

  var startBot = (team, type) => {
    console.log(team.name + " start bot")
    if (type == 'login') {
      connectOnLogin(team)
    } else if (type == 'create') {
      connectOnInstall(team)
    }
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

