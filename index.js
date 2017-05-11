'use strict';

const Arlo = require('node-arlo');
const EventEmitter = require('events').EventEmitter;

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

        if (deviceType === "basestation") {
            this.log("Found: Base Station - %s [%s]", deviceName, device.id);

            let accessory = new PlatformAccessory(deviceName, UUIDGen.generate(device.id));

            accessory.getService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Manufacturer, "Arlo");

            accessory.addService(Service.SecuritySystem, deviceName);

            this.accessories[accessory.UUID] = new ArloBaseStationAccessory(this.log, this.config, accessory, device);
            this.api.registerPlatformAccessories("homebridge-arlo", "Arlo", [accessory]);
        }
        else if (deviceType === "camera") {
            // TODO
        }
    }

    configureAccessory(accessory) {
        this.accessories[accessory.UUID] = accessory;
    }

    setupListeners() {
        this.api.on('didFinishLaunching', function() {
            var arlo = new Arlo();

            arlo.on("found", function(device) {
                let uuid = UUIDGen.generate(device.id);
                let accessory = this.accessories[uuid];

                if (accessory === undefined) {
                    this.addAccessory(device);
                }
                else if(device.getType() === "basestation") {
                    this.log("Online: Base Station %s [%s]", accessory.displayName, device.id);
                    this.accessories[uuid] = new ArloBaseStationAccessory(this.log, this.config, (accessory instanceof ArloBaseStationAccessory ? accessory.accessory : accessory), device);
                }
                else if(device.getType() === "camera") {
                    // TODO
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
            60000
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

