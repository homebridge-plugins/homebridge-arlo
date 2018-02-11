# homebridge-arlo

[![npm package](https://nodei.co/npm/homebridge-arlo.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/homebridge-arlo/)

[![NPM Version](https://img.shields.io/npm/v/homebridge-arlo.svg)](https://www.npmjs.com/package/homebridge-arlo)
[![Dependency Status](https://img.shields.io/versioneye/d/nodejs/arlo.svg)](https://www.versioneye.com/nodejs/homebridge-arlo/)
[![Slack Channel](https://img.shields.io/badge/slack-homebridge--arlo-e01563.svg)](https://homebridgeteam.slack.com/messages/C5C0Z6XPW)

Arlo platform plugin for [Homebridge](https://github.com/nfarina/homebridge).

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-arlo
3. Update your configuration file. See the sample below.

# Updating

- `npm update -g homebridge-arlo`

# Setup
Arlo only allows a single login to each account at a time, as a result, if you
are running Homebridge and the Arlo on the same account... logging in on your
iPhone to view cameras will log out homebridge's Arlo access.

Therefore, I **highly recommend** creating an additional account in Arlo, just
for homebridge access.

# Limitations
This plugin currently only support Base Stations, not cameras. This is mainly
because I haven't gotten video streaming to work yet.

# Configuration

 ```javascript
"platforms": [
    {
        "platform": "Arlo",
        "name": "Arlo",
        "email": "<insert arlo account email address>",
        "password": "<insert arlo account password>"
        "interval": 6000 
    }
]

```
NOTE: interval time is in milliseconds - e.g. 6000 ms are 10 sec

## Optional parameters
By default, Arlo only provides two modes (**armed** and **disarmed**). Since
HomeKit allows a security system to have 4 states (**away**, **home**,
**night** and **off**), we provide two config parameters to enable support for
the additional 2 states. If these configuration parameters aren't provided
setting the state to **home** or **night** will result in the state being set
to **away**, i.e. **armed**.

Arlo uses the string `modeX` to identify each mode, with `mode0` used for the
default **disarmed** state and `mode1` used for the default **armed** state.
To determine the correct `modeX` string for your custom state, login to the
[Arlo web console](https://arlo.netgear.com) and click the "Edit Mode"  button.
The URL will show the ` modeX` string for that custom state, e.g.
 https\://arlo.netgear.com/#/modes/`<USER_ID>`/edit/**mode2**

Once you've determined the `modeX` string of your custom mode(s), you can
configure `homebridge-arlo` to use those for the additional modes available
via HomeKit:

* `stay_arm` - The `modeX` label for the custom mode created in Arlo for the
**home** or **stay** state.
* `night_arm` - The `modeX` label for the custom mode created in Arlo for the
**night** state.


### Sample Configuration with Optional Parameters

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
