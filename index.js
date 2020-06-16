'use strict';

const Arlo = require('node-arlo');
const debug = require('debug')('Homebridge-Arlo');
const ArloCameraSource = require('./ArloCameraSource.js');

const DEFAULT_SUBSCRIBE_TIME = 60000;

let Accessory, PlatformAccessory, Characteristic, Service, StreamController, UUIDGen, HAP;

module.exports = function (homebridge) {
    Accessory = homebridge.hap.Accessory;
    PlatformAccessory = homebridge.platformAccessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;
    StreamController = homebridge.hap.StreamController;
    UUIDGen = homebridge.hap.uuid;
    HAP = homebridge.hap;

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
        if (!api || api.version < 2.1) { throw new Error('Unexpected API version (less than 2.1)') }
        this.accessories = {};
        this.log = log;

        this.config = this.config || {};

        let include_cameras = true
        if (this.config.include_cameras === undefined) {
            this.config.include_cameras = true
        }

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
        else if (deviceType === Arlo.CAMERA && this.config.include_cameras === true) {
            this.log("Found: Camera - %s [%s]", deviceName, device.id);

            let accessory = new PlatformAccessory(deviceName, UUIDGen.generate(device.id), Accessory.Categories.CAMERA);

            
            let service = accessory.getService(Service.AccessoryInformation);

            service.setCharacteristic(Characteristic.Manufacturer, "Arlo")
                   .setCharacteristic(Characteristic.Model, deviceModel);

            service.getCharacteristic(Characteristic.FirmwareRevision);
            service.getCharacteristic(Characteristic.HardwareRevision);

            accessory.addService(Service.BatteryService, deviceName);
            accessory.addService(Service.MotionSensor, deviceName);

            service = accessory.addService(Service.CameraControl, deviceName);
            service = accessory.addService(Service.Microphone, deviceName);

            service.addCharacteristic(Characteristic.NightVision);
            service.addCharacteristic(Characteristic.ImageMirroring);
            service.addCharacteristic(Characteristic.ImageRotation)
                    .setProps({
                        maxValue: 180,
                        minValue: 0,
                        minStep: 180
                    });

            accessory.configureCameraSource(new ArloCameraSource(this.log, accessory, device, HAP, this.config.streaming));

            this.accessories[accessory.UUID] = new ArloCameraAccessory(this.log, accessory, device);
            this.api.publishCameraAccessories("homebridge-arlo", [accessory]);
        }
        else if (deviceType === Arlo.Q && this.config.include_cameras === true) {
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

            accessory.configureCameraSource(new ArloCameraSource(this.log, accessory, device, HAP, this.config.streaming));

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
                else if(device.getType() === Arlo.CAMERA && this.config.include_cameras === true) {
                    this.log("Online: Camera %s [%s]", accessory.displayName, device.id);
                    this.accessories[uuid] = new ArloCameraAccessory(this.log, (accessory instanceof ArloCameraAccessory ? accessory.accessory : accessory), device);
                }
                else if(device.getType() === Arlo.Q && this.config.include_cameras === true) {
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
