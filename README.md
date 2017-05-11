# homebridge-arlo
[![NPM Version](https://img.shields.io/npm/v/homebridge-arlo.svg)](https://www.npmjs.com/package/homebridge-arlo)
[![Dependency Status](https://img.shields.io/versioneye/d/nodejs/arlo.svg)](https://www.versioneye.com/nodejs/homebridge-arlo/)

Arlo platform plugin for [Homebridge](https://github.com/nfarina/homebridge).

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-arlo
3. Update your configuration file. See the sample below.

# Updating

- npm update -g homebridge-arlo

# Configuration

Configuration sample:

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

