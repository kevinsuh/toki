# [Toki](https://tokibot.com): attention management for teams

**Toki is an attention management slackbot for teams.** Its goal is to enable focused work for individuals, while maintaining the awesome benefits of Slack (collaboration, transparency and fun).

We have noticed a growing problem: our daily attention can't grow at the exponential rate of technology. The resulting information overload and context switching drains the 4 to 6 hours of daily attention that we have per day. We believe this must be solved in order for technology to truly be leveraged for our productivity.

Toki enables individuals to focus on a specific task by sharing to their team what they're working on, while automatically turning on Do-Not-Disturb (DND) in Slack. Toki will store this information and provide you with daily reflections of how you spent your time.

Toki is written in Javascript and uses the excellent [Botkit](https://github.com/howdyai/botkit) and [Wit](https://wit.ai) libraries.


- [Main Features](#main-features)
- [Modules](#modules)
- [Directory Structure](#directory-structure)
- [Running on Development](#running-development)
- [Running on Production](#running-production)
- [Product Roadmap](#product-roadmap)
- [Authors](#authors)


<a name="main-features"/>
# Main Features
### Focus sessions
<img src="/build/public/images/focus_example.png" width="60%" alt="Focus sessions">
  * `/focus [task] for [time]`
  * Turns on your DND in Slack while in "focus" mode
  * Shares what you are working on to your team
  * Toki stores this information for daily / weekly reflection
  * You can end your session at any point, which turns off your DND (via interactive button, or `/end`)

### View your team's pulse
<img src="/build/public/images/pulse_example.png" width="60%" alt="Team Pulse">
  * Toki will dynamically update its channels whenever one of the channel members enters a focus session
  * This allows you to create information channels (i.e. `#pulse-backend`) and get a snapshot of what teams are focused on
  * You are able to send notifications through each teammate's `Collaborate Now` button, where Toki sends a ping through to the focusing user and starts a conversation
  * See what an individual is up to with `/pulse @user`

### Daily Reflection
<img src="/build/public/images/reflection_example.png" width="60%" alt="Daily Reflection">
  * Toki provides you with a daily cadence of how you spent your time
  * This helps build a habit of intentionality with your time, and see pictures of what you got done each day and week

```
Note: Toki has a web-app interface in its product roadmap and thus comes with the foundation for one using Express and EJS. There is no front-end framework (React or Angular) configured yet, but one would be instealled in the `/app` directory, which also holds an `/api` folder for RESTful calls.
```




<a name="modules"/>
# Modules

Toki, a node.js bot using the [Botkit](https://github.com/howdyai/botkit) framework, uses the following modules:
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

<a name="directory-structure">
# Directory Structure
Since Toki uses a compiler for both ES6 ([Babel](https://babeljs.io/)) and SCSS ([node-sass](https://github.com/sass/node-sass)), we have one directory for our source code `/src`, and one directory for our deployment `/build`.

**Notes:**
  * Code that does need to be compiled is held at the root-level of our project. Currently, this only includes config files and our `/views` directory
  * Our assets are held in `/build/public` since we use the `/build` directory for deployment

**This is the overall structure of Toki**:
```
build/
├── app/                                  // Express web server
│   ├── api/                              // RESTful API endpoints
│   ├── migrations/                       // Sequelize DB migrations
│   ├── models/                           // Sequelize Models
│   ├── router/                           // Express routes
│   ├── cron.js/                          // Cron job functions
├── bot/                                  // Slackbot
│   ├── actions/                          // Proactive actions
│   ├── controllers/                      // Botkit controllers to handle Slack events and conversations
│   ├── lib/                              // Slackbot helpers
│   ├── middleware/                       // Botkit middleware functions
├── public/                               // Static assets
├── server.js/                            // Our starting point
```

**Notes:**
* There are two main sub-directores: `app` and `bot`
  * `app` is for our Express web application, including routes, models that link up to our DB tables, and our API calls
  * `bot` holds the functionality for Toki's existence in slack
    * `controllers` are used to respond to user events, and engage them in conversation
    * `actions` are when Toki proactively reaches out
* `cron.js` is used for our focus sessions and daily reflections. It holds various functions that get run every 5 seconds (configured in `server.js`)
* `server.js` is where our ExpressJS app is created, and where Toki's installed bots are turned on to listen to [Slack RTM](https://api.slack.com/rtm)


<a name="running-development"/>
## Running on Development
Toki makes use of compilers for ES6 ([Babel](https://babeljs.io/)) and SCSS ([node-sass](https://github.com/sass/node-sass)) to be translated into ES5 and CSS, respectively.

Notes:
  * `npm run compile` is an NPM script that runs babel, node-sass, and sequelize db:migrate to make changes
  * Toki also comes with the scripts `npm run watch-css` and `npm run watch-babel` to run in the background and compile a file from `/src` to `build` everytime you save changes

<a name="running-production"/>
## Running on Production
For production, Toki uses Digital Ocean and [pm2](https://github.com/Unitech/pm2), a production process manager for Node.js applications.
*This project uses a forked version of botkit-middleware-witai for custom configuration*

Notes:
* Toki comes with a production bot and development bot by default
  * dev_toki is used for development purposes
  * Development environment triggers dev_toki and local postgres DB
* dotenv picks up whether there is `NODE_ENV` environment variable. If no `NODE_ENV`, will default to `development`. Please specify `NODE_ENV=production` on your prodution server
* Production server holds some env variables through SHELL, and some through .env file. DB_HOST is necessary to be updated on shell

<a name="product-roadmap"/>
## Product Roadmap
Our ideas for the product roadmap are held in our [public Trello board](https://trello.com/b/AYIEVUsN/product-development-roadmap). We'd love to hear suggestions, and work together towards a better future! You can add comments directly in Trello.

<a name="authors"/>
## Authors
[Kevin Suh](https://github.com/kevinsuh) ([@kevinsuh34](https://twitter.com/kevinsuh34)) is the primary developer for Toki. Additional help from [Chip Koziara](https://github.com/chipkoziara) ([@chipkoziara](https://twitter.com/chipkoziara). For inquiries, reach out at [kevinsuh34@gmail.com](https://mail.google.com/a/?view=cm&fs=1&to=kevinsuh34@gmail.com). For issues related specifically to Toki's codebase, please post on our [issues](https://github.com/kevinsuh/toki/issues) page.



