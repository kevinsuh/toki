# Toki: your personal time fairy

Toki is a **slackbot** that helps you accomplish the things that you intend to each day. Its goal is to help you make the most of your time and attention each day, so you can do the things that are most important to you.

The inspiration comes from a growing problem. Our attention is being arbitraged by internet companies. As technology grows, our attention is the only thing that doesn't scale accordingly. We want to build technology that's on our side, that cares about our values and intentions holistically. A personal fairy companion to help guide us through each day's adventure.

Toki is written in Javascript and uses the slackbot framework [botkit](https://github.com/howdyai/botkit) for the bot and [wit](https://github.com/wit-ai/node-wit) for NL parsing.


- [Main Features](#main-features)
- [Technology Stack](#technology-stack)
- [Config](#config)
- [Running on Development](#running-development)
- [Running on Production](#running-production)
- [Eventual Features](#eventual-features)
- [Authors](#authors)




<a name="main-features"/>
# Main Features
* Start your day
> View/add pending tasks
> Add new tasks
> Prioritize tasks
> Add time to tasks
> Launch into work session
* Start Work Session
  * Choose tasks to work on
  * Get time estimate
  * Checkin or start through buttons
* End Work Session
  * Cross out finished tasks
  * Take a break
* View/edit tasks
  * Add tasks and prioritize
  * Finish ("cross out") tasks
* End your day
  * Calculate total minutes worked with Toki
  * Add reflection note to be stored for future use

<a name="technology-stack"/>
# Technology Stack


<a name="config"/>
# Config

<a name="running-development"/>
# Running on Development

<a name="running-production"/>
# Running on Production

<a name="eventual-features"/>
# Eventual Features

<a name="authors"/>
# Authors



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
* dev_toki is used for development purposes
* dotenv picks up whether there is `NODE_ENV`. If no `NODE_ENV`, will default to "development"
* Development environment triggers dev_toki and local sqlite DB
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