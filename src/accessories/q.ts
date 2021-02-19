import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
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
export class ArloQAccessory extends ArloPlatformAccessory {
  private services: Service[] = [];

  constructor(
    protected readonly platform: ArloPlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);

    // get the SecuritySystem service if it exists, otherwise create a new SecuritySystem service
    // you can create multiple services for each accessory
    this.services['securitySystem'] =
      this.accessory.getService(this.platform.Service.SecuritySystem) ||
      this.accessory.addService(this.platform.Service.SecuritySystem);

    // get the CameraControl service if it exists, otherwise create a new CameraControl service
    // you can create multiple services for each accessory
    this.services['cameraControl'] =
      this.accessory.getService(this.platform.Service.CameraControl) ||
      this.accessory.addService(this.platform.Service.CameraControl);

    // get the MotionSensor service if it exists, otherwise create a new MotionSensor service
    // you can create multiple services for each accessory
    this.services['motionSensor'] =
      this.accessory.getService(this.platform.Service.MotionSensor) ||
      this.accessory.addService(this.platform.Service.MotionSensor);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE');

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/SecuritySystem

    // register handlers for the Security System Target State Characteristic
    this.services['securitySystem']
      .getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .on('set', this.setSecuritySystemTargetState.bind(this)); // SET - bind to the `setOn` method below

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

    // register handlers for the Motion Detected Characteristic
    this.services['cameraControl']
      .getCharacteristic(this.platform.Characteristic.ImageRotation)
      .on('get', this.getMotionDetected.bind(this)); // GET - bind to the 'getMotionDetected` method below

    // Here we update the security system state using
    // the `updateCharacteristic` method.
    this.device.on(Arlo.ARMED, () => {
      // push the new value to HomeKit
      this.services['securitySystem'].updateCharacteristic(
        this.platform.Characteristic.SecuritySystemCurrentState,
        this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
      );
      this.services['securitySystem'].updateCharacteristic(
        this.platform.Characteristic.SecuritySystemTargetState,
        this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM,
      );

      this.platform.log.debug(
        'Pushed updated current Security System state to HomeKit:',
        'Away Arm',
      );
    });

    // Here we update the security system state using
    // the `updateCharacteristic` method.
    this.device.on(Arlo.DISARMED, () => {
      // push the new value to HomeKit
      this.services['securitySystem'].updateCharacteristic(
        this.platform.Characteristic.SecuritySystemCurrentState,
        this.platform.Characteristic.SecuritySystemCurrentState.DISARMED,
      );
      this.services['securitySystem'].updateCharacteristic(
        this.platform.Characteristic.SecuritySystemTargetState,
        this.platform.Characteristic.SecuritySystemTargetState.DISARM,
      );

      this.platform.log.debug(
        'Pushed updated current Security System state to HomeKit:',
        'Disarmed',
      );
    });

    if (this.platform.config.stay_arm !== Arlo.ARMED) {
      // Here we update the security system state using
      // the `updateCharacteristic` method.
      this.device.on(this.platform.config.stay_arm, () => {
        // push the new value to HomeKit
        this.services['securitySystem'].updateCharacteristic(
          this.platform.Characteristic.SecuritySystemCurrentState,
          this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM,
        );
        this.services['securitySystem'].updateCharacteristic(
          this.platform.Characteristic.SecuritySystemTargetState,
          this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM,
        );

        this.platform.log.debug(
          'Pushed updated current Security System state to HomeKit:',
          'Stay Arm',
        );
      });
    }

    if (this.platform.config.night_arm !== Arlo.ARMED) {
      // Here we update the security system state using
      // the `updateCharacteristic` method.
      this.device.on(this.platform.config.night_arm, () => {
        // push the new value to HomeKit
        this.services['securitySystem'].updateCharacteristic(
          this.platform.Characteristic.SecuritySystemCurrentState,
          this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM,
        );
        this.services['securitySystem'].updateCharacteristic(
          this.platform.Characteristic.SecuritySystemTargetState,
          this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM,
        );

        this.platform.log.debug(
          'Pushed updated current Security System state to HomeKit:',
          'Night Arm',
        );
      });
    }

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

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if Motion is detected.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getMotionDetected(callback: CharacteristicGetCallback) {
    this.device.get();

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, null);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Security System.
   */
  setSecuritySystemTargetState(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ) {
    switch (value) {
      case this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM:
        this.device.setMode(this.platform.config.stay_arm, () => {
          this.device.emit(this.platform.config.stay_arm);
        });
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM:
        this.device.arm(() => {
          this.device.emit(Arlo.ARMED);
        });
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        this.device.arm(this.platform.config.night_arm, () => {
          this.device.emit(this.platform.config.night_arm);
        });
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.DISARM:
        this.device.disarm(() => {
          this.device.emit(Arlo.DISARMED);
        });
        break;
    }

    this.platform.log.debug(
      'Set Characteristic Security System Target State ->',
      value,
    );

    // you must call the callback function
    callback(null);
  }
}
