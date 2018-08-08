'use strict';

const Arlo = require('node-arlo');
const crypto = require('crypto');
const ip = require('ip');

const EventEmitter = require('events').EventEmitter;

const DEFAULT_SUBSCRIBE_TIME = 60000;

let Accessory, PlatformAccessory, Characteristic, Service, StreamController, UUIDGen;

module.exports = function (homebridge) {
    Accessory = homebridge.hap.Accessory;
    PlatformAccessory = homebridge.platformAccessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;
    StreamController = homebridge.hap.StreamController;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform('homebridge-arlo', 'Arlo', ArloPlatform, true);
};

class ArloPlatform {
    constructor(log, config, api) {
        if (!config) {
            log.warn("Ignoring Arlo Platform setup because it is not configured");
            this.disabled = true;
            return;
        }

        this.config = config;
        this.api = api;
        this.accessories = {};
        this.log = log;

        this.setupListeners();
    }

    addAccessory(device) {
        let deviceName  = device.getName(),
            deviceModel = device.getModel(),
            deviceType  = device.getType();

        if (deviceType === Arlo.BASESTATION) {
            this.log("Found: Base Station - %s [%s]", deviceName, device.id);

            let accessory = new PlatformAccessory(deviceName, UUIDGen.generate(device.id));

            accessory.getService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Manufacturer, "Arlo");

            accessory.addService(Service.SecuritySystem, deviceName);

            this.accessories[accessory.UUID] = new ArloBaseStationAccessory(this.log, this.config, accessory, device);
            this.api.registerPlatformAccessories("homebridge-arlo", "Arlo", [accessory]);
        }
        else if (deviceType === Arlo.CAMERA) {
            this.log("Found: Camera - %s [%s]", deviceName, device.id);

            let accessory = new PlatformAccessory(device.id, UUIDGen.generate(device.id), Accessory.Categories.CAMERA);

            let service = accessory.getService(Service.AccessoryInformation);

            service.setCharacteristic(Characteristic.Manufacturer, "Arlo")
                   .setCharacteristic(Characteristic.Model, deviceModel);

            service.getCharacteristic(Characteristic.FirmwareRevision);
            service.getCharacteristic(Characteristic.HardwareRevision);

            accessory.addService(Service.BatteryService, deviceName);
            accessory.addService(Service.MotionSensor, deviceName);

            service = accessory.addService(Service.CameraControl, deviceName);

            service.addCharacteristic(Characteristic.NightVision);
            service.addCharacteristic(Characteristic.ImageMirroring);
            service.addCharacteristic(Characteristic.ImageRotation)
                    .setProps({
                        maxValue: 180,
                        minValue: 0,
                        minStep: 180
                    });

            accessory.configureCameraSource(new ArloCameraSource(this.log, accessory, device));

            this.accessories[accessory.UUID] = new ArloCameraAccessory(this.log, accessory, device);
            this.api.publishCameraAccessories("homebridge-arlo", [accessory]);
        }
        else if (deviceType === Arlo.Q) {
            this.log("Found: Camera - %s [%s]", device.id, device.id);

            let accessory = new PlatformAccessory(device.id, UUIDGen.generate(device.id), Accessory.Categories.CAMERA);

            let service = accessory.getService(Service.AccessoryInformation);

            service.setCharacteristic(Characteristic.Manufacturer, "Arlo")
                   .setCharacteristic(Characteristic.Model, deviceModel);

            service.getCharacteristic(Characteristic.FirmwareRevision);
            service.getCharacteristic(Characteristic.HardwareRevision);

            accessory.addService(Service.MotionSensor, deviceName);

            service = accessory.addService(Service.CameraControl, deviceName);

            service.addCharacteristic(Characteristic.NightVision);
            service.addCharacteristic(Characteristic.ImageMirroring);
            service.addCharacteristic(Characteristic.ImageRotation)
                    .setProps({
                        maxValue: 180,
                        minValue: 0,
                        minStep: 180
                    });

            accessory.configureCameraSource(new ArloCameraSource(this.log, accessory, device));

            accessory.addService(Service.SecuritySystem, deviceName);

            this.accessories[accessory.UUID] = new ArloQAccessory(this.log, this.config, accessory, device);
            this.api.publishCameraAccessories("homebridge-arlo", [accessory]);
        }
    }

    configureAccessory(accessory) {
        this.accessories[accessory.UUID] = accessory;
    }

    setupListeners() {
        this.api.on('didFinishLaunching', function() {
            var arlo = new Arlo();

            arlo.on(Arlo.FOUND, function(device) {
                let uuid = UUIDGen.generate(device.id);
                let accessory = this.accessories[uuid];

                if (accessory === undefined) {
                    this.addAccessory(device);
                }
                else if(device.getType() === Arlo.BASESTATION) {
                    this.log("Online: Base Station %s [%s]", accessory.displayName, device.id);
                    this.accessories[uuid] = new ArloBaseStationAccessory(this.log, this.config, (accessory instanceof ArloBaseStationAccessory ? accessory.accessory : accessory), device);
                }
                else if(device.getType() === Arlo.CAMERA) {
                    this.log("Online: Camera %s [%s]", accessory.displayName, device.id);
                    this.accessories[uuid] = new ArloCameraAccessory(this.log, (accessory instanceof ArloCameraAccessory ? accessory.accessory : accessory), device);
                }
                else if(device.getType() === Arlo.Q) {
                    this.log("Online: Camera %s [%s]", accessory.displayName, device.id);
                    this.accessories[uuid] = new ArloQAccessory(this.log, this.config, (accessory instanceof ArloQAccessory ? accessory.accessory : accessory), device);
                }
            }.bind(this));

            arlo.login(this.config.email, this.config.password);
        }.bind(this));
    }
}

class ArloBaseStationAccessory {
    constructor(log, config, accessory, device) {
        this.accessory = accessory;
        this.device = device;
        this.log = log;
        
        config = config || {};

        this.STAY_ARM = config.stay_arm || Arlo.ARMED;
        this.NIGHT_ARM = config.night_arm || Arlo.ARMED;
        this.interval = config.interval || DEFAULT_SUBSCRIBE_TIME;

        this.accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Model, device.getModel())
            .setCharacteristic(Characteristic.SerialNumber, device.getSerialNumber());

        this.setupListeners();
        this.accessory.updateReachability(true);
    }

    setupListeners() {
        this.accessory
            .getService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on('set', this.setTargetState.bind(this));
    
        this.device.on(Arlo.ARMED, function() {
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(Characteristic.SecuritySystemTargetState.AWAY_ARM);
    
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(Characteristic.SecuritySystemCurrentState.AWAY_ARM);
        }.bind(this));
        
        this.device.on(Arlo.DISARMED, function() {
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(Characteristic.SecuritySystemTargetState.DISARM);
    
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(Characteristic.SecuritySystemCurrentState.DISARMED);
        }.bind(this));

        if (this.STAY_ARM !== Arlo.ARMED) {
            this.device.on(this.STAY_ARM, function() {
                this.accessory
                    .getService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .updateValue(Characteristic.SecuritySystemTargetState.STAY_ARM);
        
                this.accessory
                    .getService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .updateValue(Characteristic.SecuritySystemCurrentState.STAY_ARM);
            }.bind(this));
        }

        if (this.NIGHT_ARM !== Arlo.ARMED) {
            this.device.on(this.NIGHT_ARM, function() {
                this.accessory
                    .getService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .updateValue(Characteristic.SecuritySystemTargetState.NIGHT_ARM);
        
                this.accessory
                    .getService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .updateValue(Characteristic.SecuritySystemCurrentState.NIGHT_ARM);
            }.bind(this));
        }
        
        setInterval(
            function(){
                this.device.subscribe();
            }.bind(this),
            (this.interval)
        );
    }

    setTargetState(state, callback) {
        switch(state) {
            case Characteristic.SecuritySystemTargetState.AWAY_ARM:
                this.device.arm(function() {
                    callback(null);
                    this.device.emit(Arlo.ARMED);
                }.bind(this));
                break;
            case Characteristic.SecuritySystemTargetState.DISARM:
                this.device.disarm(function() {
                    callback(null);
                    this.device.emit(Arlo.DISARMED);
                }.bind(this));
                break;
            case Characteristic.SecuritySystemTargetState.STAY_ARM:
                this.device.setMode(this.STAY_ARM, function() {
                    callback(null);
                    this.device.emit(this.STAY_ARM);
                }.bind(this));
                break;
            case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
                this.device.setMode(this.NIGHT_ARM, function() {
                    callback(null);
                    this.device.emit(this.NIGHT_ARM);
                }.bind(this));
                break;
        }
    }
}

class ArloCameraAccessory {
    constructor(log, accessory, device) {
        this.accessory = accessory;
        this.device = device;
        this.log = log;

        this.accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Model, device.getModel())
            .setCharacteristic(Characteristic.SerialNumber, device.getSerialNumber());

        this.setupListeners();
        this.device.get();
    }

    setupListeners() {
        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.On)
            .on('set', this.setPrivacyActive.bind(this));

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.ImageMirroring)
            .on('set', this.setImageMirroring.bind(this));

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.ImageRotation)
            .on('set', this.setImageRotation.bind(this));

        setTimeout(function(){
            this.device.get();
        }.bind(this));

        this.device.on(Arlo.BATTERY, this.updateBatteryLevel.bind(this));
        this.device.on(Arlo.CHARGING, this.updateChargingState.bind(this));
        this.device.on(Arlo.MOTION, this.updateMotionDetected.bind(this));

        this.device.on(Arlo.UPDATE, function(info) {
            this.updateInfo(info);
            this.updateConnectionState(info.connectionState);
            this.updateImageMirroring(info.mirror);
            this.updateImageRotation(info.flip);
            this.updateNightVision(info.nightVisionMode);
            this.updatePrivacyActive(info.privacyActive);
        }.bind(this));
    }

    setImageMirroring(value, callback) {
        this.device.set({mirror: value}, function() {
            callback(null);
        })
    }

    setImageRotation(value, callback) {
        this.device.set({flip: (value > 0 ? true : false)}, function() {
            callback(null);
        })
    }

    setPrivacyActive(value, callback) {
        this.device.set({privacyActive: value == false}, function() {
            callback(null);
        })
    }

    updateInfo(info) {
        if (info === undefined) {
            return;
        }

        let service = this.accessory.getService(Service.AccessoryInformation);

        if (info.modelId) {
            service.getCharacteristic(Characteristic.Model).updateValue(info.modelId);
        }

        if (info.serialNumber) {
            service.getCharacteristic(Characteristic.SerialNumber).updateValue(info.serialNumber);
        }

        if (info.swVersion) {
            service.getCharacteristic(Characteristic.FirmwareRevision).updateValue(info.swVersion);
        }

        if (info.hwVersion) {
            service.getCharacteristic(Characteristic.HardwareRevision).updateValue(info.hwVersion);
        }
    }

    updateBatteryLevel(batteryLevel) {
        if (batteryLevel === undefined) {
            return;
        }

        this.accessory
            .getService(Service.BatteryService)
            .getCharacteristic(Characteristic.BatteryLevel)
            .updateValue(batteryLevel);
    }

    updateChargingState(value) {
        let state = Characteristic.ChargingState.NOT_CHARGEABLE;

        if (value !== undefined) {
            state = value != 'Off' ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGING;
        }

        this.accessory
            .getService(Service.BatteryService)
            .getCharacteristic(Characteristic.ChargingState)
            .updateValue(state);
    }

    updateConnectionState(connectionState) {
        if (connectionState === undefined) {
            return;
        }

        let online = connectionState === 'available';
        this.log("%s: Camera %s [%s]", (online ? 'Online' : 'Offline'), this.accessory.displayName, this.device.id);
    }

    updateMotionDetected(motionDetected) {
        if (motionDetected === undefined) {
            return;
        }

        this.accessory
            .getService(Service.MotionSensor)
            .getCharacteristic(Characteristic.MotionDetected)
            .updateValue(motionDetected);
    }

    updateImageMirroring(mirror) {
        if (mirror === undefined) {
            return;
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.ImageMirroring)
            .updateValue(mirror);
    }

    updateImageRotation(flip) {
        if (flip === undefined) {
            return;
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.ImageRotation)
            .updateValue(flip === true ? 180 : 0);
    }

    updateNightVision(nightVisionMode) {
        if (nightVisionMode === undefined) {
            return;
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.NightVision)
            .updateValue(nightVisionMode === 1);
    }

    updatePrivacyActive(privacyActive) {
        if (privacyActive === undefined) {
            return;
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.On)
            .updateValue(privacyActive == false);
    }
}

class ArloCameraSource extends EventEmitter {
    constructor(log, accessory, device) {
        super();
        this.log = log;
        this.accessory = accessory;
        this.device = device;
        this.services = [];
        this.pendingSessions = {};
        this.ongoingSessions = {};
        this.streamControllers = [];
        this.lastSnapshot = null;

        this.videoProcessor = 'ffmpeg';
        this.videoCodec = "h264_omx";
        this.audioCodec = "libfdk_aac";
        this.packetsize = 1316; // 188, 376
        this.additionalCommandline = "";

        let options = {
            proxy: false, // Requires RTP/RTCP MUX Proxy
            srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
            video: {
                resolutions: [
                    [1280, 720, 30],
                    [1280, 720, 15],
                    [640, 360, 30],
                    [640, 360, 15],
                    [320, 240, 30],
                    [320, 240, 15]
                ],
                codec: {
                    profiles: [0, 1, 2],    //[StreamController.VideoCodecParamProfileIDTypes.MAIN],
                    levels: [0, 1, 2]       //[StreamController.VideoCodecParamLevelTypes.TYPE4_0]
                }
            },
            audio: {
                codecs: [
                    {
                        type: 'OPUS',
                        samplerate: 24
                    },
                    {
                        type: "AAC-eld",
                        samplerate: 16
                    }
                ]
            }
        }

        this._createCameraControlService();
        this._createStreamControllers(options);
    }

    handleCloseConnection(connectionID) {
        this.streamControllers.forEach(function(controller) {
            controller.handleCloseConnection(connectionID);
        });
    }

    handleSnapshotRequest(request, callback) {
        let now = Date.now();

        if (this.lastSnapshot && now < this.lastSnapshot + 300000) {
            this.log('Snapshot skipped: Camera %s [%s] - Next in %d secs', this.accessory.displayName, this.device.id, parseInt((this.lastSnapshot + 300000 - now) / 1000));
            callback();
            return;
        }

        this.log("Snapshot request: Camera %s [%s]", this.accessory.displayName, this.device.id);

        this.device.getSnapshot(function(error, data) {
            if (error) {
                this.log(error);
                callback();
                return;
            }

            this.lastSnapshot = Date.now();

            this.log("Snapshot confirmed: Camera %s [%s]", this.accessory.displayName, this.device.id);

           this.device.once(Arlo.FF_SNAPSHOT, function(url) {
                this.device.downloadSnapshot(url, function (data) {
                    this.log("Snapshot downloaded: Camera %s [%s]", this.accessory.displayName, this.device.id);
                    callback(undefined, data);
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }

    prepareStream(request, callback) {
        this.log("prepareStream");

        /*
        this.device.getStream(function(error, data, body) {
            this.log(body);
            callback();
        }.bind(this));
        */

        this.device.getStream(function (streamURL) {

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
                // SSRC is a 32 bit integer that is unique per stream
                let ssrcSource = crypto.randomBytes(4);
                ssrcSource[0] = 0;
                let ssrc = ssrcSource.readInt32BE(0, true);

                let videoResponse = {
                    port: targetPort,
                    ssrc: ssrc,
                    srtp_key: srtp_key,
                    srtp_salt: srtp_salt
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
                    srtp_salt: srtp_salt
                };

                response["audio"] = audioResp;

                sessionInfo["audio_port"] = targetPort;
                sessionInfo["audio_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
                sessionInfo["audio_ssrc"] = ssrc;
            }

            let currentAddress = ip.address();
            var addressResp = {
                address: currentAddress
            };

            if (ip.isV4Format(currentAddress)) {
                addressResp["type"] = "v4";
            } else {
                addressResp["type"] = "v6";
            }

            response["address"] = addressResp;
            this.pendingSessions[UUIDGen.unparse(sessionID)] = sessionInfo;

            callback(response);
        });
    }

    handleStreamRequest(request) {
        this.log("handleStreamRequest");

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
                    var fps = 30;
                    var vbitrate = 300;
                    var abitrate = 32;
                    var asamplerate = 16;
                    var vcodec = this.videoCodec;
                    var acodec = this.audioCodec;
                    var packetsize = this.packetsize || 1316;
                    var additionalCommandline = this.additionalCommandline;

                    let videoInfo = request["video"];
                    if (videoInfo) {
                        width = videoInfo["width"];
                        height = videoInfo["height"];

                        let expectedFPS = videoInfo["fps"];
                        if (expectedFPS < fps) {
                            fps = expectedFPS;
                        }
                        if(videoInfo["max_bit_rate"] < vbitrate) {
                            vbitrate = videoInfo["max_bit_rate"];
                        }
                    }

                    let audioInfo = request["audio"];
                    if (audioInfo) {
                        abitrate = audioInfo["max_bit_rate"];
                        asamplerate = audioInfo["sample_rate"];
                    }

                    let streamURL = sessionInfo["streamURL"];

                    let targetAddress = sessionInfo["address"];
                    let targetVideoPort = sessionInfo["video_port"];
                    let videoKey = sessionInfo["video_srtp"];
                    let videoSsrc = sessionInfo["video_ssrc"];
                    let targetAudioPort = sessionInfo["audio_port"];
                    let audioKey = sessionInfo["audio_srtp"];
                    let audioSsrc = sessionInfo["audio_ssrc"];

                    let ffmpegCommand = '-re -i ' + streamURL + ' -map 0:0' +
                      ' -vcodec ' + vcodec +
                      ' -pix_fmt yuv420p' +
                      ' -r ' + fps +
                      ' -f rawvideo' +
                      ' ' + additionalCommandline +
                      ' -vf scale=' + width + ':' + height +
                      ' -b:v ' + vbitrate + 'k' +
                      ' -bufsize ' + vbitrate+ 'k' +
                      ' -maxrate '+ vbitrate + 'k' +
                      ' -payload_type 99' +
                      ' -ssrc ' + videoSsrc +
                      ' -f rtp' +
                      ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
                      ' -srtp_out_params ' + videoKey.toString('base64') +
                      ' srtp://' + targetAddress + ':' + targetVideoPort +
                      '?rtcpport=' + targetVideoPort +
                      '&localrtcpport=' + targetVideoPort +
                      '&pkt_size=' + packetsize;

                    if(this.audio){
                        ffmpegCommand+= ' -map 0:1' +
                        ' -acodec ' + acodec +
                        ' -profile:a aac_eld' +
                        ' -flags +global_header' +
                        ' -f null' +
                        ' -ar ' + asamplerate + 'k' +
                        ' -b:a ' + abitrate + 'k' +
                        ' -bufsize ' + abitrate + 'k' +
                        ' -ac 1' +
                        ' -payload_type 110' +
                        ' -ssrc ' + audioSsrc +
                        ' -f rtp' +
                        ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
                        ' -srtp_out_params ' + audioKey.toString('base64') +
                        ' srtp://' + targetAddress + ':' + targetAudioPort +
                        '?rtcpport=' + targetAudioPort +
                        '&localrtcpport=' + targetAudioPort +
                        '&pkt_size=' + packetsize;
                    }

                    let ffmpeg = spawn(this.videoProcessor, ffmpegCommand.split(' '), {env: process.env});
                    this.log("Start streaming video from " + this.name + " with " + width + "x" + height + "@" + vbitrate + "kBit");
                    if(this.debug){
                        console.log("ffmpeg " + ffmpegCommand);
                    }

                    // Always setup hook on stderr.
                    // Without this streaming stops within one to two minutes.
                    ffmpeg.stderr.on('data', function(data) {
                        // Do not log to the console if debugging is turned off
                        if(this.debug){
                            console.log(data.toString());
                        }
                    });

                    let self = this;
                    ffmpeg.on('error', function(error){
                        self.log("An error occurs while making stream request");
                        self.debug ? self.log(error) : null;
                    });
                    ffmpeg.on('close', (code) => {
                        if(code == null || code == 0 || code == 255){
                            self.log("Stopped streaming");
                        } else {
                            self.log("ERROR: FFmpeg exited with code " + code);
                            for(var i=0; i < self.streamControllers.length; i++){
                                var controller = self.streamControllers[i];
                                if(controller.sessionIdentifier === sessionID){
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
                    ffmpegProcess.kill('SIGTERM');
                }
            }
        }
    }

    _createStreamControllers(options) {
        //this.log("_createStreamControllers");
        let streamController = new StreamController(1, options, this);

        this.services.push(streamController.service);
        this.streamControllers.push(streamController);
    }

    _createCameraControlService() {
        var controlService = new Service.CameraControl();
        this.services.push(controlService);
        if(this.audio){
            var microphoneService = new Service.Microphone();
        }
        this.services.push(microphoneService);
    }
}

class ArloQAccessory {
    constructor(log, config, accessory, device) {
        this.accessory = accessory;
        this.device = device;
        this.log = log;

        config = config || {};

        this.STAY_ARM = config.stay_arm || Arlo.ARMED;
        this.NIGHT_ARM = config.night_arm || Arlo.ARMED;
        this.interval = config.interval || DEFAULT_SUBSCRIBE_TIME;

        this.accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Model, device.getModel())
            .setCharacteristic(Characteristic.SerialNumber, device.getSerialNumber());

        this.setupListeners();
    }

    setupListeners() {
        this.accessory
            .getService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on('set', this.setTargetState.bind(this));

        this.device.on(Arlo.ARMED, function() {
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(Characteristic.SecuritySystemTargetState.AWAY_ARM);

            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(Characteristic.SecuritySystemCurrentState.AWAY_ARM);
        }.bind(this));

        this.device.on(Arlo.DISARMED, function() {
            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(Characteristic.SecuritySystemTargetState.DISARM);

            this.accessory
                .getService(Service.SecuritySystem)
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(Characteristic.SecuritySystemCurrentState.DISARMED);
        }.bind(this));

        if (this.STAY_ARM !== Arlo.ARMED) {
            this.device.on(this.STAY_ARM, function() {
                this.accessory
                    .getService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .updateValue(Characteristic.SecuritySystemTargetState.STAY_ARM);

                this.accessory
                    .getService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .updateValue(Characteristic.SecuritySystemCurrentState.STAY_ARM);
            }.bind(this));
        }

        if (this.NIGHT_ARM !== Arlo.ARMED) {
            this.device.on(this.NIGHT_ARM, function() {
                this.accessory
                    .getService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemTargetState)
                    .updateValue(Characteristic.SecuritySystemTargetState.NIGHT_ARM);

                this.accessory
                    .getService(Service.SecuritySystem)
                    .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .updateValue(Characteristic.SecuritySystemCurrentState.NIGHT_ARM);
            }.bind(this));
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.On)
            .on('set', this.setPrivacyActive.bind(this));

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.ImageMirroring)
            .on('set', this.setImageMirroring.bind(this));

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.ImageRotation)
            .on('set', this.setImageRotation.bind(this));

        this.accessory
            .getService(Service.MotionSensor)
            .getCharacteristic(Characteristic.MotionDetected)
            .on('get', this.get.bind(this));

        this.device.on(Arlo.MOTION, this.updateMotionDetected.bind(this));

        this.device.on(Arlo.UPDATE, function(info) {
            this.updateInfo(info);
            this.updateConnectionState(info.connectionState);
            this.updateImageMirroring(info.mirror);
            this.updateImageRotation(info.flip);
            this.updateNightVision(info.nightVisionMode);
            this.updatePrivacyActive(info.privacyActive);
        }.bind(this));

        setInterval(
            function() {
                this.device.subscribe();
            }.bind(this),
            (this.interval)
        );
    }

    get(callback) {
        if (this.device) {
            this.device.get();
        }

        callback(null, null)
    }

    setImageMirroring(value, callback) {
        this.device.set({mirror: value}, function() {
            callback(null);
        })
    }

    setImageRotation(value, callback) {
        this.device.set({flip: (value > 0 ? true : false)}, function() {
            callback(null);
        })
    }

    setPrivacyActive(value, callback) {
        this.device.set({privacyActive: value == false}, function() {
            callback(null);
        })
    }

    setTargetState(state, callback) {
        switch(state) {
            case Characteristic.SecuritySystemTargetState.AWAY_ARM:
                this.device.arm(function() {
                    callback(null);
                    this.device.emit(Arlo.ARMED);
                }.bind(this));
                break;
            case Characteristic.SecuritySystemTargetState.DISARM:
                this.device.disarm(function() {
                    callback(null);
                    this.device.emit(Arlo.DISARMED);
                }.bind(this));
                break;
            case Characteristic.SecuritySystemTargetState.STAY_ARM:
                this.device.setMode(this.STAY_ARM, function() {
                    callback(null);
                    this.device.emit(this.STAY_ARM);
                }.bind(this));
                break;
            case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
                this.device.setMode(this.NIGHT_ARM, function() {
                    callback(null);
                    this.device.emit(this.NIGHT_ARM);
                }.bind(this));
                break;
        }
    }

    updateInfo(info) {
        if (info === undefined) {
            return;
        }

        let service = this.accessory.getService(Service.AccessoryInformation);

        if (info.modelId) {
            service.getCharacteristic(Characteristic.Model).updateValue(info.modelId);
        }

        if (info.serialNumber) {
            service.getCharacteristic(Characteristic.SerialNumber).updateValue(info.serialNumber);
        }

        if (info.swVersion) {
            service.getCharacteristic(Characteristic.FirmwareRevision).updateValue(info.swVersion);
        }

        if (info.hwVersion) {
            service.getCharacteristic(Characteristic.HardwareRevision).updateValue(info.hwVersion);
        }
    }

    updateConnectionState(connectionState) {
        if (connectionState === undefined) {
            return;
        }

        let online = connectionState === 'available';
        this.log("%s: Camera %s [%s]", (online ? 'Online' : 'Offline'), this.accessory.displayName, this.device.id);
    }

    updateMotionDetected(motionDetected) {
        if (motionDetected === undefined) {
            return;
        }

        this.accessory
            .getService(Service.MotionSensor)
            .getCharacteristic(Characteristic.MotionDetected)
            .updateValue(motionDetected);
    }

    updateImageMirroring(mirror) {
        if (mirror === undefined) {
            return;
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.ImageMirroring)
            .updateValue(mirror);
    }

    updateImageRotation(flip) {
        if (flip === undefined) {
            return;
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.ImageRotation)
            .updateValue(flip === true ? 180 : 0);
    }

    updateNightVision(nightVisionMode) {
        if (nightVisionMode === undefined) {
            return;
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.NightVision)
            .updateValue(nightVisionMode === 1);
    }

    updatePrivacyActive(privacyActive) {
        if (privacyActive === undefined) {
            return;
        }

        this.accessory
            .getService(Service.CameraControl)
            .getCharacteristic(Characteristic.On)
            .updateValue(privacyActive == false);
    }
}
