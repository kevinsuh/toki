# Toki: your personal time fairy

**Toki is a slackbot that helps you accomplish the things that you intend to each day.** Its goal is to help you make the most of your time and attention, so you can do the things that are most important to you.

We have personally noticed a growing problem: **_our attention is being arbitraged by internet companies._** As technology grows, our attention doesn't scale accordingly. This leads to an unceasing competition for a limited resource that is most important to each of us: our time and attention. We want to build technology that's on our side of this battle, that cares about our values and intentions holistically.

Toki is written in Javascript and uses the excellent [botkit](https://github.com/howdyai/botkit) and [wit](https://wit.ai) libraries.


- [Main Features](#main-features)
- [Technology Stack](#technology-stack)
- [Config](#config)
- [Directory Structure](#directory-structure)
- [Running on Development](#running-development)
- [Running on Production](#running-production)
- [Eventual Features](#eventual-features)
- [Authors](#authors)


<a name="main-features"/>
# Main Features
#### Start your day
  * View/add pending tasks
  * Add new tasks
  * Prioritize tasks
  * Add time to tasks
  * Launch into work session

#### Start Work Session
  * Choose tasks to work on
  * Get time estimate
  * Checkin or start through buttons

#### End Work Session
  * Cross out finished tasks
  * Take a break

#### View/edit tasks
  * Add tasks and prioritize
  * Finish ("cross out") tasks

#### End your day
  * Calculate total minutes worked with Toki
  * Add reflection note to be stored for future use

<a name="technology-stack"/>
# Technology Stack

#### Web Server
* Digital Ocean
* PostgreSQL
* Node.js
* ExpressJS
* React-Redux

#### Slack Bot
* Node.js
* Botkit
* Wit.ai

#### Libraries/Dependencies
* Babel
* SCSS
* Sequelize
* Moment-Timezone
* EmbeddedJS

<a name="config"/>
# Config
`config.json` holds DB config settings
We use a shell variable to hold our production DB settings, which Sequelize recognizes.

<a name="directory-structure">
# Directory Structure
Since Toki uses a precompiler for both our ES6 and SCSS, we have one directory for our source code `/src`, and one directory for our deployment code `/build`.

Code that does not need to be precompiled is held outside of the `/build` and `/src` directories and and is held at the root-level of our project. Currently, outside of our various config files, that only includes our `EJS views`.

Since the `/build` directory is a simple transpiling of our `/src` directory, the structure within each _should be_ the exact same. 

**The following is the structure of the `/build` directory** _(excluding files in nested directories)_:
```
build/
├── app/
│   ├── api/
│   │   ├── v1/
│   ├── migrations/
│   ├── models/
│   ├── router/
│   │   │   ├── routes/
│   ├── cron.js/
│   ├── scripts.js/
├── bot/
│   ├── actions/
│   │   ├── initiation/
│   ├── controllers/
│   │   │   ├── buttons/
│   │   │   ├── days/
│   │   │   ├── misc/
│   │   │   ├── reminders/
│   │   │   ├── tasks/
│   │   │   ├── work_sessions/
│   ├── lib/
│   ├── middleware/
├── dev_slackbot.js/
├── server.js/
```

**Notes:**
* There are two main sub-directores: `app` and `bot`. The `app` directory is for our web server. The `bot` directory is for Toki's existence in slack.
  * `app` holds our web page routes, the models that link up to our DB, our DB migrations, and our API calls
  * `bot` holds the functionality needed for our conversation in slack
    * `controllers` are used to take user input and respond appropriately, and to engage users in appropriate contexts
    * `actions` are when we proactively reach out, such as when user first signs in with our slack button
    * `lib` holds various helper functions
* `cron.js` is used for our reminders and work_sessions functionality. It runs a script that checks our DB every 5 seconds.
* `server.js` is where our ExpressJS app is created, and where our various bots are turned on to listen to [Slack RTM](https://api.slack.com/rtm)


<a name="running-development"/>
## Running on Development
Toki makes use of precompilers for ES6 and SCSS code to be translated into ES5 and CSS, respectively. The packages `node-sass` and `babel-present-es2015` are used for this. **_since node-sass and babel both only watch for saves, if you delete files you must delete from both directories_**

`npm run precompile` is an NPM script that runs babel, node-sass, and sequelize db:migrate to convert changes. **_Make sure all mapping and migration is done successfully before pushing to github__**

**Common commands:**
```
npm run precompile
git push origin master
```
The `master` branch is used to as the single source for production-ready code. Commit to this branch with extreme caution.

For additional features create a branch `feature-*`, and for hotfixes create a branch `hotfix-*`. These should always be tested thoroughly before submitting a pull request into master.

<a name="running-production"/>
## Running on Production
To run our production server, Toki uses [pm2](https://github.com/Unitech/pm2), which is a production process manager for Node.js applications.

We can use the NPM script `npm run prepare-production` to run a sequelize migrate and reset of our pm2 server. There may be occasions where you want to `npm update` on remote too, if one of our primary libraries goes through a massive update (will happen to botkit, wit, botkit-kit-middleware, etc.).

**Common commands:**
```
git pull origin master
npm run prepare-production
```

Notes:
* both development and production have environment variables
* dev_toki is used for development purposes
* dotenv picks up whether there is `NODE_ENV`. If no `NODE_ENV`, will default to `development`
* Development environment triggers dev_toki and local postgres DB
* Production server holds some env variables through SHELL, and some through .env file. DB_HOST is absolutely necessary to be updated on shell

<a name="eventual-features"/>
## Eventual Features
Features are held in our [internal trello board](https://trello.com/b/AYIEVUsN/product-development-roadmap) under the list **Feature Requests (Confirmed)**. These features are prioritized in a queue. Some larger buckets:
- [ ] Splash page with signup ability
- [ ] Add button flow to all parts of flow, ex. starting day
- [ ] Revamp end-day flow
- [ ] Google cal integration
- [ ] Personal analytics on our web app

<a name="authors"/>
## Authors
[Kevin Suh](https://github.com/kevinsuh) ([@kevinsuh34](https://twitter.com/kevinsuh34)) is a co-founder and the primary developer for Toki. For inquiries, reach out at [kevinsuh34@gmail.com](https://mail.google.com/a/?view=cm&fs=1&to=kevinsuh34@gmail.com). For issues related specifically to Toki's codebase, please post on our [issues](https://github.com/kevinsuh/toki/issues) page.



