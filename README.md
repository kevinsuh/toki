# Navi's existence in slack.

### Core functionalities:
* Take task list
* Prioritize task list
* Organize work sessions
* Reflect and recalibrate
* Keep track of what you got done and how you felt

#### Eventual features:
* GCal integration
* Analytics


#### How the flow works
_make this more organized in the future_

On development:
- `env = development`
* src directory for ES6 code
* build directory for transpiled code
* production server is based solely off of `master` branch
* 1. `npm run precompile` to trigger babel, node-sass, and sequelize db migrate
* 2. `git push origin master`

On production:
- `env = production`
* `git pull origin master`
* `npm run prepare-production` to trigger sequlize migrate and reset of pm2 server (to pick up new `build` code)

Notes:
* both development and production have environment variables
* dev_navi is used for development purposes
* dotenv picks up whether there is `NODE_ENV`. If no `NODE_ENV`, will default to "development"
* Development environment triggers dev_navi and local sqlite DB
* Production server holds some env variables through SHELL, and some through .env file. DB_HOST is absolutely necessary to be updated on shell

Flow:
* Keep development updates as either `feature` or `hotfix` for organization
* `feature` is for longer lasting development cycles
* `hotfix` is for bugs found on production
* it is paramount to keep `master` branch clean. Everything must be tested and ready to go before it is merged into `master`. For bug fixes, use hotfix to organize code

## Directory flow
* `src` for ES6 code. Development purposes
* `build` for ES5 code. Production and Deployment purposes


## This to add to this readme:
* Common terminologies (start day, end day, work session, add task)
* Features of this bot and ideology
* Database tables and columns
* Organized list of commands for reference
* Primary organization of flow (`convo.on('end')` and going through `confirm_new_session_group` as dispatch center)