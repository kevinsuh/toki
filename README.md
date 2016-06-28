# Toki: your personal time fairy

**Toki is a _slackbot_ that helps you accomplish the things that you intend to each day.** Its goal is to help you make the most of your time and attention each day, so you can do the things that are most important to you.

We have personally noticed a growing problem: our attention is being arbitraged by internet companies. As technology grows, our attention does not scale accordingly. This leads to a constantly increasing competition for a limited resource that is most important to each of us: our time and attention. We want to build technology that's on our side; a personal companion that cares about our values and intentions holistically.

Toki is written in Javascript and uses the excellent [botkit](https://github.com/howdyai/botkit) and [wit](https://github.com/wit-ai/node-wit) libraries.


- [Main Features](#main-features)
- [Technology Stack](#technology-stack)
- [Config](#config)
- [Running on Development](#running-development)
- [Running on Production](#running-production)
- [Eventual Features](#eventual-features)
- [Authors](#authors)




<a name="main-features"/>
## Main Features
* **Start your day**
  * View/add pending tasks
  * Add new tasks
  * Prioritize tasks
  * Add time to tasks
  * Launch into work session
* **Start Work Session**
  * Choose tasks to work on
  * Get time estimate
  * Checkin or start through buttons
* **End Work Session**
  * Cross out finished tasks
  * Take a break
* **View/edit tasks**
  * Add tasks and prioritize
  * Finish ("cross out") tasks
* **End your day**
  * Calculate total minutes worked with Toki
  * Add reflection note to be stored for future use

<a name="technology-stack"/>
## Technology Stack
* Node.js
* Digital Ocean
* PostgreSQL
* Wit.ai
* Botkit
* EmbeddedJS
* ExpressJS
* React-Redux
* Babel
* SCSS
* Sequelize

<a name="config"/>
## Config
`config.json` holds DB config settings

<a name="directory-structure">
## Directory Structure


<a name="running-development"/>
## Running on Development
Toki makes use of precompilers for ES6 and SCSS code to be translated into ES5 and CSS, respectively. The packages `node-sass` and `babel-present-es2015` are used to make this happen.

`npm run precompile` is an NPM script that runs babel, node-sass, and sequelize db:migrate to convert changes. **_Make sure all mapping and migration is done successfully before pushing to github__**

Common commands:
```
npm run precompile
git push origin master
```
The `master` branch is used to as the single source for production-ready code. Commit to this branch with extreme caution.

For additional features, create a branch `feature-*`, and for hotfixes create a branch `hotfix-*`. These should be then tested thoroughly before submitting a pull request into master.

<a name="running-production"/>
## Running on Production
To run our production server, Toki uses [pm2](https://github.com/Unitech/pm2), which is a production process manager for Node.js applications with a built-in load balancer.

We can use the NPM script `npm run nprepare-production` to run sequelize migrate and a reset of pm2 server. There may be occasions where you want to `npm update` on remote too, if one of our primary libraries goes through a massive update (will happen to botkit, wit, botkit-kit-middleware, etc.).

Common commands:
```
git pull origin master
npm run prepare-production
```

Notes:
* both development and production have environment variables
* dev_toki is used for development purposes
* dotenv picks up whether there is `NODE_ENV`. If no `NODE_ENV`, will default to "development"
* Development environment triggers dev_toki and local postgres DB
* Production server holds some env variables through SHELL, and some through .env file. DB_HOST is absolutely necessary to be updated on shell

<a name="eventual-features"/>
## Eventual Features
Features are held in the internal trello board titled `Product Roadmap`. These features are prioritized in a queue. Some larger buckets:
- [ ] Splash page with signup ability
- [ ] Add button flow to all parts of flow, ex. starting day
- [ ] Robust end-day flow
- [ ] Google cal integration
- [ ] Personal analytics on our web app

<a name="authors"/>
## Authors
[Kevin Suh](https://github.com/kevinsuh) ([@kevinsuh34](https://twitter.com/kevinsuh34)) is the CTO, co-founder, and current sole developer of Toki. For issues related specifically to Toki's codebase, please post on our [issues](https://github.com/kevinsuh/toki/issues) page.




## This to add to this readme:
* Directory structure
* Database tables and columns
* Primary organization of flow (`convo.on('end')` and going through `confirm_new_session_group` as dispatch center)




