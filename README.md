# homebridge-arlo
[![NPM Version](https://img.shields.io/npm/v/homebridge-arlo.svg)](https://www.npmjs.com/package/homebridge-arlo)
[![Dependency Status](https://img.shields.io/versioneye/d/nodejs/arlo.svg)](https://www.versioneye.com/nodejs/homebridge-arlo/)
[![Slack Channel](https://img.shields.io/badge/slack-homebridge--arlo-e01563.svg)](https://homebridgeteam.slack.com/messages/C5C0Z6XPW)

Arlo platform plugin for [Homebridge](https://github.com/nfarina/homebridge).

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-arlo
3. Update your configuration file. See the sample below.

# Updating

- npm update -g homebridge-arlo

# Setup
Arlo only allows a single login to each account at a time, as a result, if you are running Homebridge and the Arlo on the same account...logging in on your iPhone to view cameras will log out homebridge's Arlo access.

Therefore, I **highly recommend** creating an additional account in Arlo, just for homebridge access.

# Limitations
This plugin currently only support Base Stations, not cameras. This is mainly because I haven't gotten video streaming to work yet.

# Configuration

 ```javascript
"platforms": [
    {
        "platform": "Arlo",
        "name": "Arlo",
        "email": "<insert arlo account email address>",
        "password": "<insert arlo account password>"
    }
]

```

## Optional parameters
By default, Arlo only provides two modes (**armed** and **disarmed**). Since HomeKit allows a security system to have 4 statees (**away**, **home**, **night** and **off**), we provide two config parameters to enable support for the additional 2 states. If these configuration parameters aren't provided setting the state to **home** or **night** will result in the state being set to **away**.

`stay_arm` - The string label for the mode created in Arlo for the **home** or **stay** state.

`night_arm` - The string label for the mode created in Arlo for the **night** state.

Sample Configuration

 ```javascript
"platforms": [
    {
        "platform": "Arlo",
        "name": "Arlo",
        "email": "<insert arlo account email address>",
        "password": "<insert arlo account password>",
        "stay_arm": "mode2",
        "night_arm": "mode3"
    }
]

```

# Siri commands
**Arming - Away Mode**<br/>
_Set the security system to armed/away_

**Disarming - Off Mode**<br/>
_Set the security system to disarmed/off_

**Arming - Home Mode**<br/>
_Set the security system to stay_

**Arming - Night Mode**<br/>
_Set the security system to night_


