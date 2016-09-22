# [Toki](https://tokibot.com): attention management for teams

**Toki is a slackbot that brings focused work to collaborative teams.** Its goal is to enable focused work for individuals, while maintaining the awesome benefits of Slack (collaboration, transparency and fun).

We have noticed a growing problem: our daily attention can't grow at the exponential rate of technology. The resulting information overload and context switching drains the 4 to 6 hours of daily attention that we have per day. We believe this must be solved in order for technology to truly be leveraged for our productivity.

Toki enables individuals to focus on a specific task by sharing to their team what they're working on, while automatically turning on Do-Not-Disturb (DND) in Slack. Toki will store this information and provide you with daily reflections of how you spent your time.

Toki is written in Javascript and uses the excellent [Botkit](https://github.com/howdyai/botkit) and [Wit](https://wit.ai) libraries.


- [Main Features](#main-features)
- [Directory Structure](#directory-structure)
- [Getting Started](#getting-started)
- [Modules](#modules)
- [Development](#development)
- [Running on Production](#running-production)
- [Product Roadmap](#product-roadmap)
- [Authors](#authors)


<a name="main-features"/>
# Main Features
### Focus sessions
<img src="/build/public/gifs/focus.gif" height="250px" alt="Focus sessions">
  * `/focus [task] for [time]`
  * Turns on your DND in Slack while in "focus" mode
  * Shares what you are working on to your team
  * Toki stores this information for daily / weekly reflection
  * You can end your session at any point, which turns off your DND (via interactive button, or `/end`)

### View your team's pulse
<img src="/build/public/gifs/dashboard.gif" height="250px" alt="Team Pulse">
  * Toki will dynamically update its channels whenever one of the channel members enters a focus session
  * This allows you to create information channels (i.e. `#pulse-backend`) and get a snapshot of what teams are focused on
  * See what an individual is up to with `/pulse @user`

### Send appropriate notifications
<img src="/build/public/gifs/collaborate.gif" height="250px" alt="Collaborate Now">
  * You are able to send notifications through each teammate's `Collaborate Now` button, through which Toki temporarily turns off the user's DND and sends a ping to start a conversation
  * This helps segment notifications to only be ones that preserve an individual's context or is actually urgent
  * You are also able to `Collaborate Now` when you see an individual's specific `/pulse @user`

### Daily Reflection
<img src="/build/public/images/reflection_example.png" height="250px" alt="Daily Reflection">
  * Toki provides you with a daily cadence of how you spent your time
  * This helps build a habit of intentionality with your time, and see pictures of what you got done each day and week

*Note: Toki has a web interface in its roadmap and currently comes with the foundation for one through Express and EJS. There is no front-end framework configured yet, but one would be installed in the* `/app` *directory, which also holds an* `/api` *folder for RESTful calls.*

*In the future, we would separate into two node apps (one for the slackbot and one for the web app).*

<a name="directory-structure">
# Directory Structure
```
build/
├── app/                                  // Web server
│   ├── api/                                  // RESTful API endpoints
│   ├── migrations/                           // Sequelize DB migrations
│   ├── models/                               // Sequelize Models
│   ├── router/                               // Express routes
│   ├── cron.js/                              // Cron job functions
├── bot/                                  // Slackbot
│   ├── actions/                              // Bot initiates conversation
│   ├── controllers/                          // Botkit controllers to handle Slack events and conversations
│   ├── lib/                                  // Slackbot helpers
│   ├── middleware/                           // Botkit middleware functions
├── public/                               // Static assets
├── server.js/                            // App starting point
```

**Notes:**
* There are two main sub-directores: `app` and `bot`
  * `app` is for our Express web application, including routes, models that link up to our DB tables, and our API calls
  * `bot` holds the functionality for Toki's existence in slack
    * `controllers` are used to respond to user events, and engage them in conversation
    * `actions` are when Toki proactively reaches out
* Since Toki uses a compiler for both ES6 ([Babel](https://babeljs.io/)) and SCSS ([node-sass](https://github.com/sass/node-sass)), we have one directory for our source code `/src`, and one directory for our deployment `/build`.
  * This means actual development is done in `/src` directory, which Babel uses to compile into the `/build` directory for deployment
  * Code that does need to be compiled is held at the root-level of our project. Currently, this only includes config files and our `/views` directory
    * Our static assets are held in `/build/public`
* `cron.js` is used for our focus sessions and daily reflections. It holds various functions that get run every 5 seconds (configured in `server.js`)
* `server.js` is where our ExpressJS app is created, and where Toki's installed bots are turned on to listen via [Slack RTM](https://api.slack.com/rtm)

<a name="getting-started">
# Getting Started
First, fork the repository and install node dependencies by navigating to the root of your local repository and running `npm install`.

**By default, Toki comes with configuration for a development bot and a production bot** so that you can continue developing your bot and test new functionalities while it is live and on others' teams. This means you will have to create two separate Slack apps and do basic configuration for each. Here are the steps:

1. Create your [two slack apps](https://api.slack.com/slack-apps) (one for development and one for production)
2. Set up your environment variables. You can modify and rename the provided .env-example file:
  ```
  SLACK_ID=your.productionSlackId
  SLACK_SECRET=yourProductionSlackSecret
  SLACK_REDIRECT=https://yourproduction.site

  DEV_SLACK_ID=your.developmentSlackId
  DEV_SLACK_SECRET=yourDevelopmentSlackSecret
  DEV_SLACK_REDIRECT=http://localhost:8080/

  VERIFICATION_TOKEN=1kKzBPfFPOujZiFajN9uRGFe

  WIT_TOKEN=yourwittoken
  HTTP_PORT=8080
  ```
  *Make sure to put* `NODE_ENV=production` *as an environment variable on your production server. This allows Toki to know whether to start up the production bot or the development bot*
3. Get your apps' verification tokens for [Slash commands](https://api.slack.com/slash-commands)
4. Create a [Wit.api](https://wit.ai/getting-started) app and set your wit token
  * Wit token is located in settings of your Wit app under `Server Access Token`
5. Decide deployment strategy
  * We used Digital Ocean for deployment
    * Configure environment variables while SSH'd into the server. This is done by creating this same .env file on the server, but you must also configure DB_HOST in shell to connect to your prodution postgres DB
  * For Heroku, you can use the Heroku dashboard to add these environment variables
6. We use Postgres for storage with the [Sequelize ORM](sequelizejs.com)
  * Familiarize yourself with Sequelize and configure accordingly in `config.json`
  * You will notice that for "production", we just look at DB_HOST. This is the connection uri to your production DB. An example format is `postgresql://user:password@example.com:5432/dbname`

<a name="modules"/>
# Modules

Toki is built on top of the [Botkit](https://github.com/howdyai/botkit) framework and uses the following modules:
* [cron](https://github.com/ncb000gt/node-cron): Allows you to run a cronjob
* [botkit-middleware-witai](https://github.com/kevinsuh/botkit-middleware-witai): Forked version of Botkit's official middleware integration of Wit.ai
* [ejs](https://github.com/tj/ejs): Write embedded javascript templates for your views
* [lodash](https://github.com/lodash/lodash): A powerful javascript utility library for arrays, objects, numbers, and more
* [moment-timezone](https://github.com/moment/moment-timezone): For dealing with dates and timezones for your Slack users
* [sequelize](https://github.com/sequelize/sequelize): Promise-based Node ORM, which we use for Postgres
* [nlp_compromise](https://github.com/nlp-compromise/nlp_compromise): A javascript utility library for natural language
* [babel](https://github.com/babel/babel): Compiler that transforms ES6 into javascript that can run in any browser
* [node-sass](https://github.com/sass/node-sass): Compilers for .scss files to css
* [dotenv](https://github.com/motdotla/dotenv): Allows you to load environment variables from a `.env` file

<a name="development"/>
## Development
As mentioned above, Toki comes with a production bot and a development bot by default. You can name your development bot whatever you want. For reference, our production bot is named `toki` and our development bot is named `dev_toki`.

Actual development is done inside the `/src` directory, and its changes are compiled into the `/build` directory via [babel](https://github.com/babel/babel) and [node-sass](https://github.com/sass/node-sass) for deployment. This allows us to use ES6 and SCSS while developing.

Toki comes with the scripts `npm run watch-css` and `npm run watch-babel` to run in the background and compile a file from `/src` into its mirror location in `/build` each time you save a change.

<a name="running-production"/>
## Running on Production
For production, Toki uses Digital Ocean and [pm2](https://github.com/Unitech/pm2), a production process manager for Node.js applications.

**Notes:**
* Toki comes with a production bot and development bot by default
  * Development environment triggers dev_toki and local postgres DB
  * Production environment is identified via environment variable `NODE_ENV=production`. Otherwise, it's assumed you are in development. Specify `NODE_ENV=production` on your prodution server
* This project uses a forked version of botkit-middleware-witai for custom configuration
* Production server holds some env variables through shell, and some through .env file. DB_HOST is necessary to be updated on shell

<a name="product-roadmap"/>
## Product Roadmap
Our ideas for the product roadmap are held in our [public Trello board](https://trello.com/b/AYIEVUsN/product-development-roadmap). We'd love to hear suggestions, and work together towards a better future! You can add comments directly in Trello.

<a name="authors"/>
## Authors
[Kevin Suh](https://github.com/kevinsuh) ([@kevinsuh34](https://twitter.com/kevinsuh34)) is the primary developer for Toki. Additional development from [Chip Koziara](https://github.com/chipkoziara) ([@chipkoziara](https://twitter.com/chipkoziara)). For inquiries, reach out at [kevinsuh34@gmail.com](https://mail.google.com/a/?view=cm&fs=1&to=kevinsuh34@gmail.com). For issues related specifically to Toki's codebase, please post on our [issues](https://github.com/kevinsuh/toki/issues) page.



