const EventEmitter = require("events").EventEmitter;
const debug = require("debug")("Homebridge-Arlo:CameraSource");
const debugFFmpeg = require("debug")("ffmpeg");
const crypto = require("crypto");
const ip = require("ip");
const spawn = require("child_process").spawn;

let StreamController, UUIDGen;

class ArloCameraSource extends EventEmitter {
  constructor(log, accessory, device, hap, config) {
    super();

    StreamController = hap.StreamController;
    UUIDGen = hap.uuid;

    this.log = log;
    this.accessory = accessory;
    this.device = device;
    this.services = [];
    this.pendingSessions = {};
    this.ongoingSessions = {};
    this.streamControllers = [];
    this.lastSnapshot = null;

    this.videoProcessor = config.videoProcessor || "ffmpeg";
    this.videoDecoder = config.videoDecoder || "";
    this.videoEncoder = config.videoEncoder || "libx264";
    this.audioCodec = config.audioEncoder || "libopus";
    this.packetsize = config.packetsize || 1316; //188, 376, 1316
    this.fps = 24;
    this.maxBitrate = config.maxBitrate || 300;
    this.additionalVideoCommands = config.additionalVideoCommands
      ? " " + config.additionalVideoCommands
      : "";
    this.additionalAudioCommands = config.additionalAudioCommands
      ? " " + config.additionalAudioCommands
      : "";

    let numberOfStreams = config.maxStreams || 2;

    let options = {
      proxy: false, // Requires RTP/RTCP MUX Proxy
      srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
      video: {
        resolutions: [
          [1280, 720, 24],
          [1280, 720, 15],
          [640, 360, 24],
          [640, 360, 15],
          [320, 240, 24],
          [320, 240, 15],
        ],
        codec: {
          profiles: [0, 1, 2], //[StreamController.VideoCodecParamProfileIDTypes.MAIN],
          levels: [0, 1, 2], //[StreamController.VideoCodecParamLevelTypes.TYPE4_0]
        },
      },
      audio: {
        codecs: [
          {
            type: "OPUS",
            samplerate: 24,
            comfort_noise: true,
          },
        ],
      },
    };

    this._createStreamControllers(numberOfStreams, options);
    debug("Generated Camera Controller");
  }

  handleCloseConnection(connectionID) {
    this.streamControllers.forEach(function (controller) {
      controller.handleCloseConnection(connectionID);
    });
  }

  handleSnapshotRequest(request, callback) {
    debug("Snapshot requested");

    this.log(
      "Snapshot request: Camera %s [%s]",
      this.accessory.displayName,
      this.device.id
    );

    this.device.downloadSnapshot(
      this.device.device.presignedLastImageUrl,
      function (data) {
        this.log(
          "Snapshot downloaded: Camera %s [%s]",
          this.accessory.displayName,
          this.device.id
        );
        callback(undefined, data);
      }.bind(this)
    );
  }

  prepareStream(request, callback) {
    debug("Prepare stream request");

    var self = this;

    this.device.getStream(function (streamURL) {
      debug("Preparing stream for URL: %s", streamURL);
      debug("Prepare Stream request: %O", request);

      var sessionInfo = {};
      let sessionID = request["sessionID"];
      let targetAddress = request["targetAddress"];

      sessionInfo["streamURL"] = streamURL;
      sessionInfo["address"] = targetAddress;

      var response = {};

      let videoInfo = request["video"];
      if (videoInfo) {
        let targetPort = videoInfo["port"];
        let srtp_key = videoInfo["srtp_key"];
        let srtp_salt = videoInfo["srtp_salt"];

        // SSRC is a 32 bit integer that is unique per stream
        let ssrcSource = crypto.randomBytes(4);
        ssrcSource[0] = 0;
        let ssrc = ssrcSource.readInt32BE(0, true);

        let videoResponse = {
          port: targetPort,
          ssrc: ssrc,
          srtp_key: srtp_key,
          srtp_salt: srtp_salt,
        };

        response["video"] = videoResponse;
        sessionInfo["video_port"] = targetPort;
        sessionInfo["video_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
        sessionInfo["video_ssrc"] = ssrc;
      }

      let audioInfo = request["audio"];
      if (audioInfo) {
        let targetPort = audioInfo["port"];
        let srtp_key = audioInfo["srtp_key"];
        let srtp_salt = audioInfo["srtp_salt"];

        // SSRC is a 32 bit integer that is unique per stream
        let ssrcSource = crypto.randomBytes(4);
        ssrcSource[0] = 0;
        let ssrc = ssrcSource.readInt32BE(0, true);

        let audioResp = {
          port: targetPort,
          ssrc: ssrc,
          srtp_key: srtp_key,
          srtp_salt: srtp_salt,
        };

        response["audio"] = audioResp;

        sessionInfo["audio_port"] = targetPort;
        sessionInfo["audio_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
        sessionInfo["audio_ssrc"] = ssrc;
      }

      let currentAddress = ip.address();
      var addressResp = {
        address: currentAddress,
      };

      if (ip.isV4Format(currentAddress)) {
        addressResp["type"] = "v4";
      } else {
        addressResp["type"] = "v6";
      }

      response["address"] = addressResp;

      self.pendingSessions[UUIDGen.unparse(sessionID)] = sessionInfo;

      callback(response);
    });
  }

  handleStreamRequest(request) {
    debug("Handle Stream request: %O", request);

    var sessionID = request["sessionID"];
    var requestType = request["type"];
    if (sessionID) {
      let sessionIdentifier = UUIDGen.unparse(sessionID);

      // Start streaming
      if (requestType == "start") {
        var sessionInfo = this.pendingSessions[sessionIdentifier];
        if (sessionInfo) {
          var width = 1280;
          var height = 720;
          var fps = this.fps;
          var vbitrate = 1500;
          var packetsize = this.packetsize;
          var additionalVideoCommands = this.additionalVideoCommands;

          var vDecoder, vEncoder, scaleCommand;

          let videoInfo = request["video"];
          if (videoInfo) {
            var width = videoInfo["width"];
            var height = videoInfo["height"];

            if (width == 1280 && height == 720) {
              // No video transcoding required, use copy codec
              vDecoder = "";
              vEncoder = "copy";
              scaleCommand = "";
              debug("No change to video stream size required");
            } else {
              // Scale video requested, requiring video transcoding
              vDecoder = this.videoDecoder ? " -c:v " + this.videoDecoder : "";
              vEncoder = this.videoEncoder;
              scaleCommand = " -vf scale=" + width + ":" + height;
            }

            let expectedFPS = videoInfo["fps"];
            if (expectedFPS < fps) {
              fps = expectedFPS;
            }

            if (videoInfo["max_bit_rate"] < vbitrate) {
              vbitrate = videoInfo["max_bit_rate"];
            }
          }

          let streamURL = sessionInfo["streamURL"];

          let targetAddress = sessionInfo["address"];
          let targetVideoPort = sessionInfo["video_port"];
          let videoKey = sessionInfo["video_srtp"];
          let videoSsrc = sessionInfo["video_ssrc"];

          // Video
          let ffmpegCommand =
            "-rtsp_transport tcp" +
            vDecoder +
            " -re -i " +
            streamURL +
            " -map 0:0" +
            " -c:v " +
            vEncoder +
            " -pix_fmt yuv420p" +
            " -r " +
            fps +
            " -f rawvideo" +
            scaleCommand +
            additionalVideoCommands +
            " -b:v " +
            vbitrate +
            "k" +
            " -bufsize " +
            vbitrate +
            "k" +
            " -maxrate " +
            vbitrate +
            "k" +
            " -payload_type 99" +
            " -ssrc " +
            videoSsrc +
            " -f rtp" +
            " -srtp_out_suite AES_CM_128_HMAC_SHA1_80" +
            " -srtp_out_params " +
            videoKey.toString("base64") +
            " srtp://" +
            targetAddress +
            ":" +
            targetVideoPort +
            "?rtcpport=" +
            targetVideoPort +
            "&localrtcpport=" +
            targetVideoPort +
            "&pkt_size=" +
            packetsize;

          let ffmpeg = spawn(this.videoProcessor, ffmpegCommand.split(" "), {
            env: process.env,
          });
          debugFFmpeg(
            "Start streaming video with " +
              width +
              "x" +
              height +
              "@" +
              vbitrate +
              "kBit"
          );
          debugFFmpeg("ffmpeg " + ffmpegCommand);

          // Always setup hook on stderr.
          // Without this streaming stops within one to two minutes.
          ffmpeg.stderr.on("data", function (data) {
            // Do not log to the console if debugging is turned off
            debugFFmpeg(data.toString());
          });

          let self = this;
          ffmpeg.on("error", function (error) {
            debugFFmpeg("An error occurs while making stream request");
            debugFFmpeg(error);
          });

          ffmpeg.on("close", (code) => {
            if (code == null || code == 0 || code == 255) {
              debugFFmpeg("Stopped streaming with code %i", code);
            } else {
              debugFFmpeg("ERROR: FFmpeg exited with code " + code);
              for (var i = 0; i < self.streamControllers.length; i++) {
                var controller = self.streamControllers[i];
                if (controller.sessionIdentifier === sessionID) {
                  controller.forceStop();
                }
              }
            }
          });

          // Add to ongoing sessions now that it's been started
          this.ongoingSessions[sessionIdentifier] = ffmpeg;
        }
        // Remove from pending sessions
        delete this.pendingSessions[sessionIdentifier];
      } else if (requestType == "stop") {
        var ffmpegProcess = this.ongoingSessions[sessionIdentifier];
        if (ffmpegProcess) {
          ffmpegProcess.kill("SIGTERM");
        }
      }
    }
  }

  _createStreamControllers(numberOfStreams, options) {
    let self = this;
    for (var i = 0; i < numberOfStreams; i++) {
      var streamController = new StreamController(i, options, self);

      self.services.push(streamController.service);
      self.streamControllers.push(streamController);
    }
  }
}

module.exports = ArloCameraSource;
