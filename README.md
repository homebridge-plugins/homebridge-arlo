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
```

## Using Siri to control Arlo via Homebridge

Apple removed the ability for Siri to directly control Security Systems in
iOS 11.

However, the here are a couple of ways to workaround this restriction:

### Using HomeKit Scenes

You can add a Security System device like the Arlo device exposed via Homebridge
to a HomeKit Scene. You can then use Siri to activate that scene.

For example, if you create a scene called "_Good Morning_", you could add the
an Arlo state to that Scene and saying, "_Hey Siri, Good Morning!_" would
activate the scene and set the Arlo state accordingly.

> **Note**: HomeKit will **not** automatically activate a scene
> using geolocation (e.g. "_First person arrives home_" or "_Last person leaves
> home_") if it contains a Security System accessory. Instead, it will prompt
> you to confirm whether the scene should be activated.

### Using an dummy or virtual device

HomeKit automation can be triggered "_When an accessory is controlled_", i.e.
when the state of an accessory is changed. This means you can arm or disarm
Arlo when another accessory is controlled.

Here's how to use a virtual accessory to control Arlo:

1. Install the [`homebridge-arlo`](https://github.com/devbobo/homebridge-arlo)
plugin but _don't_ use "Arlo" as the name of the accessory in `config.json`.
1. Install the [`homebridge-dummy`](https://github.com/nfarina/homebridge-dummy)
plugin and create a stateful switch named "_Arlo_".
1. Create a HomeKit automation that arms Arlo when this stateful switch is turned
"On" and create another automation that disarms Arlo when this switch is turned
"Off".

Now, Siri's default accessory handling phrases can be used, i.e. "_Hey Siri, turn
Arlo on_". Siri will turn the virtual stateful switch on and then the automation
will automatically arm Arlo.

Likewise, you can use HomeKit geolocation to turn the virtual switch on or off
and the automation will automatically arm or disarm Arlo.
