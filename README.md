# homebridge-arlo

[![npm package](https://nodei.co/npm/homebridge-arlo.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/homebridge-arlo/)

[![donate](https://img.shields.io/badge/%24-Buy%20me%20a%20coffee-ff69b4.svg)](https://www.buymeacoffee.com/devbobo)
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
### Modes
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

### Streaming
Live video streaming functionality requires transcoding of the video and audio streams provided by Arlo into a format acceptable to HomeKit. By default, this transcoding is assumed to be performed by a local installation of FFmpeg with the `libx264` video codec and `libfdk_aac` audio codec. Alternate configuration options are provided to help optimize the transcoding performance.

- `videoProcessor`: The video processor used to perform transcoding. Defaults to `ffmpeg`. An alternate executable maybe used, however it needs to conform to ffmpeg parameters.
- `videoDecoder`: The video codec used to decode the incoming h264 stream from the Arlo server. Defaults to no value, meaning the default h.264 software decoder (`libx264`) will typically be used.
- `videoEncoder`: The video codec used to encode the outgoing h264 stream to the iOS client device. Defaults to `libx264`.
- `audioEncoder`: The audio codec that will be used to decode/encode the audio stream. HomeKit requires either an Opus or AAC-ELD format audio stream. Defaults to the `libfdk_aac` codec.
- `packetsize`: The packet sized to be used. Defaults to 1316. Use smaller multiples of 188 to possibly improve performance (376, 564, etc)
- `maxBitrate`: The maximum bitrate of the encoded stream in kbit/s, the default is 300.

### Streaming with a Raspberry Pi 3

The Raspberry Pi 3 has both hardware decoder and encoder functionality, which can help with transcoding performance. However you will need to compile FFmpeg yourself to enable the hardware capability.

Even if you unconcerned with hardware transcoding, you will likely need to compile FFmpeg with either the `Opus` or `libfdk_aac` encoders enabled in order to output the required Opus or AAC-ELD audio format.

The below defines suggested compliation steps for FFmpeg on Raspberry Pi 3 that takes advantage of both the hardware encoder (omx) and decoder (mmal), and uses `libopus-dev` and/or `libfdk_aac` to enable transcoding of the audio.

Note: This assumes you're using Raspbian Stretch.

```bash
# Go to home folder
cd ~
# Install build tools
sudo apt update
sudo apt install build-essential pkg-config autoconf automake libtool checkinstall git
# Install various dependencies
sudo apt install libssl-dev libx264-dev libopus-dev libomxil-bellagio-dev

# Clone libfdk-aac-dev 
git clone https://github.com/mstorsjo/fdk-aac.git
cd fdk-aac
# Configure and build libfdk-aac-dev
./autogen.sh
./configure --prefix=/usr/local --enable-shared --enable-static
# Uses -j4 flag to use multiple cores during compilation
make -j4
sudo make install
sudo ldconfig
cd ..

# OPTIONAL: Remove any installed ffmpeg to avoid conflicts
sudo apt remove ffmpeg
# Clone ffmpeg
git clone https://github.com/FFmpeg/FFmpeg.git
cd FFmpeg
# Configure ffmpeg
./configure --prefix=/usr/local --arch=armel --target-os=linux --enable-openssl \
      --enable-omx --enable-omx-rpi --enable-nonfree --enable-gpl --enable-libfdk-aac \
      --enable-libopus --enable-mmal --enable-libx264 --enable-decoder=h264 --enable-network \
      --enable-protocol=tcp --enable-demuxer=rtsp

# Build ffmpeg
sudo make -j4

# Install ffmpeg, and use checkinstall to build a self-contained deb file that can be easily backed up for later use or reinstallation. Fill in all information requested by checkinstall.
sudo checkinstall

# Lock the custom ffmpeg package so it isn't replaced accidentally
echo "ffmpeg hold" | sudo dpkg --set-selections
```

Thanks to KhaosT for the base ffmpeg implementation and setup instructions in [homebridge-camera-ffmpeg](https://github.com/KhaosT/homebridge-camera-ffmpeg) and the [Maniacland Blog](https://maniaclander.blogspot.com/2017/08/ffmpeg-with-pi-hardware-acceleration.html)/[locutusofborg780](https://www.reddit.com/r/raspberry_pi/comments/5677qw/hardware_accelerated_x264_encoding_with_ffmpeg/) for FFmpeg configuration instructions.

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
        "streaming": {
            "videoDecoder": "h264_mmal",
            "videoEncoder": "h264_omx",
            "packetSize": 564
        }
      }
    }
]
```
