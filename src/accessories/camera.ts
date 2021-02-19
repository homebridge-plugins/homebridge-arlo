import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
} from 'homebridge';

import { ArloPlatform } from '../platform';
import { ArloPlatformAccessory } from './platform';
import { ArloCameraSource } from './cameraSource';

import { default as Arlo } from 'node-arlo';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ArloCameraAccessory extends ArloPlatformAccessory {
  private services: Service[] = [];

  constructor(
    protected readonly platform: ArloPlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);

    // get the CameraControl service if it exists, otherwise create a new CameraControl service
    // you can create multiple services for each accessory
    this.services['cameraControl'] =
      this.accessory.getService(this.platform.Service.CameraControl) ||
      this.accessory.addService(this.platform.Service.CameraControl);

    // get the BatteryService service if it exists, otherwise create a new BatteryService service
    // you can create multiple services for each accessory
    this.services['batteryService'] =
      this.accessory.getService(this.platform.Service.BatteryService) ||
      this.accessory.addService(this.platform.Service.BatteryService);

    // get the MotionSensor service if it exists, otherwise create a new MotionSensor service
    // you can create multiple services for each accessory
    this.services['motionSensor'] =
      this.accessory.getService(this.platform.Service.MotionSensor) ||
      this.accessory.addService(this.platform.Service.MotionSensor);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.CameraControl, 'NAME', 'USER_DEFINED_SUBTYPE');

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service

    // register handlers for the On/Off Characteristic
    this.services['cameraControl']
      .getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setOn.bind(this)); // SET - bind to the `setOn` method below

    // register handlers for the Image Mirroring Characteristic
    this.services['cameraControl']
      .getCharacteristic(this.platform.Characteristic.ImageMirroring)
      .on('set', this.setImageMirroring.bind(this)); // SET - bind to the 'setImageMirroring` method below

    // register handlers for the Image Rotation Characteristic
    this.services['cameraControl']
      .getCharacteristic(this.platform.Characteristic.ImageRotation)
      .on('set', this.setImageRotation.bind(this)); // SET - bind to the 'setImageRotation` method below

    // Here we update the battery level using
    // the `updateCharacteristic` method.
    this.device.on(Arlo.BATTERY, (batteryLevel) => {
      if (!batteryLevel) {
        return;
      }

      // push the new value to HomeKit
      this.services['batteryService'].updateCharacteristic(
        this.platform.Characteristic.BatteryLevel,
        batteryLevel,
      );

      this.platform.log.debug(
        'Pushed updated current Battery Level state to HomeKit:',
        batteryLevel,
      );
    });

    // Here we update the charging state using
    // the `updateCharacteristic` method.
    this.device.on(Arlo.CHARGING, (value) => {
      let chargingState = this.platform.Characteristic.ChargingState
        .NOT_CHARGEABLE;

      if (value) {
        chargingState =
          value !== 'Off'
            ? this.platform.Characteristic.ChargingState.CHARGING
            : this.platform.Characteristic.ChargingState.NOT_CHARGING;
      }

      // push the new value to HomeKit
      this.services['batteryService'].updateCharacteristic(
        this.platform.Characteristic.ChargingState,
        chargingState,
      );

      this.platform.log.debug(
        'Pushed updated current Charging state to HomeKit:',
        chargingState,
      );
    });

    // Here we update the motion detected state using
    // the `updateCharacteristic` method.
    this.device.on(Arlo.MOTION, (motionDetected) => {
      if (!motionDetected) {
        return;
      }

      // push the new value to HomeKit
      this.services['motionSensor'].updateCharacteristic(
        this.platform.Characteristic.MotionDetected,
        motionDetected,
      );

      this.platform.log.debug(
        'Pushed updated current Motion Detected state to HomeKit:',
        motionDetected,
      );
    });

    // Here we update the information using
    // the `updateCharacteristic` method.
    this.device.on(Arlo.UPDATE, (info) => {
      if (!info) {
        return;
      }

      if (info.modelId) {
        this.accessory
          .getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Model, info.modelId);
      }

      if (info.serialNumber) {
        this.accessory
          .getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(
            this.platform.Characteristic.SerialNumber,
            info.serialNumber,
          );
      }

      if (info.hwVersion) {
        this.accessory
          .getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(
            this.platform.Characteristic.HardwareRevision,
            info.hwVersion,
          );
      }

      if (info.swVersion) {
        this.accessory
          .getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(
            this.platform.Characteristic.SoftwareRevision,
            info.swVersion,
          );
      }

      if (info.privacyActive) {
        // push the new value to HomeKit
        this.services['cameraControl'].updateCharacteristic(
          this.platform.Characteristic.On,
          info.privacyActive === false,
        );
      }

      if (info.mirror) {
        // push the new value to HomeKit
        this.services['cameraControl'].updateCharacteristic(
          this.platform.Characteristic.ImageMirroring,
          info.mirror,
        );
      }

      if (info.flip) {
        // push the new value to HomeKit
        this.services['cameraControl'].updateCharacteristic(
          this.platform.Characteristic.ImageRotation,
          info.flip === true ? 180 : 0,
        );
      }

      if (info.nightVisionMode) {
        // push the new value to HomeKit
        this.services['cameraControl'].updateCharacteristic(
          this.platform.Characteristic.NightVision,
          info.nightVisionMode === 1,
        );
      }

      if (info.connectionState) {
        const online = info.connectionState === 'available';
        this.platform.log.info(
          `${online ? 'Online' : 'Offline'}: Camera ${
            this.accessory.displayName
          } [${this.device.id}]`,
        );
      }
    });

    setInterval(() => {
      this.device.get();
    }, this.platform.config.interval);

    this.device.get();

    this.accessory.configureCameraSource(
      new ArloCameraSource(platform, accessory),
    );
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Camera.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.device.set({
      privacyActive: value === false,
    });

    this.platform.log.debug('Set Characteristic On ->', value);

    // you must call the callback function
    callback(null);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the imaging mirroring
   */
  setImageMirroring(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ) {
    this.device.set({
      mirror: value,
    });

    this.platform.log.debug('Set Characteristic Image Mirroring -> ', value);

    // you must call the callback function
    callback(null);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the imaging rotation
   */
  setImageRotation(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ) {
    this.device.set({
      flip: value > 0 ? true : false,
    });

    this.platform.log.debug('Set Characteristic Image Mirroring -> ', value);

    // you must call the callback function
    callback(null);
  }
}
