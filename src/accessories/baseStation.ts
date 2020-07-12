import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';

import { ArloPlatform } from '../platform';
import { ArloPlatformAccessory } from './platform';

import { Arlo } from 'node-arlo';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ArloBaseStationAccessory extends ArloPlatformAccessory {
  private service: Service;

  constructor(
    protected readonly platform: ArloPlatform,
    protected readonly accessory: PlatformAccessory,
  ) {

    super(platform, accessory);

    // get the SecuritySystem service if it exists, otherwise create a new SecuritySystem service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.SecuritySystem)
      || this.accessory.addService(this.platform.Service.SecuritySystem);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.SecuritySystem, 'NAME', 'USER_DEFINED_SUBTYPE');

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/SecuritySystem

    // register handlers for the Security System Target State Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .on('set', this.setSecuritySystemTargetState.bind(this));  // SET - bind to the `setOn` method below

    // Here we update the security system state using 
    // the `updateCharacteristic` method.
    this.device.on(Arlo.ARMED, () => {
      // push the new value to HomeKit
      this.service.updateCharacteristic(
        this.platform.Characteristic.SecuritySystemCurrentState,
        this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM);
      this.service.updateCharacteristic(
        this.platform.Characteristic.SecuritySystemTargetState,
        this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM);

      this.platform.log.debug('Pushed updated current Security System state to HomeKit:', 'Away Arm');
    });

    // Here we update the security system state using 
    // the `updateCharacteristic` method.
    this.device.on(Arlo.DISARMED, () => {
      // push the new value to HomeKit
      this.service.updateCharacteristic(
        this.platform.Characteristic.SecuritySystemCurrentState,
        this.platform.Characteristic.SecuritySystemCurrentState.DISARMED);
      this.service.updateCharacteristic(
        this.platform.Characteristic.SecuritySystemTargetState,
        this.platform.Characteristic.SecuritySystemTargetState.DISARM);

      this.platform.log.debug('Pushed updated current Security System state to HomeKit:', 'Disarmed');
    });

    if (this.platform.stayArm !== Arlo.ARMED) {
      // Here we update the security system state using 
      // the `updateCharacteristic` method.
      this.device.on(this.platform.stayArm, () => {
        // push the new value to HomeKit
        this.service.updateCharacteristic(
          this.platform.Characteristic.SecuritySystemCurrentState,
          this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM);
        this.service.updateCharacteristic(
          this.platform.Characteristic.SecuritySystemTargetState,
          this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM);

        this.platform.log.debug('Pushed updated current Security System state to HomeKit:', 'Stay Arm');
      });
    }

    if (this.platform.nightArm !== Arlo.ARMED) {
      // Here we update the security system state using 
      // the `updateCharacteristic` method.
      this.device.on(this.platform.nightArm, () => {
        // push the new value to HomeKit
        this.service.updateCharacteristic(
          this.platform.Characteristic.SecuritySystemCurrentState,
          this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM);
        this.service.updateCharacteristic(
          this.platform.Characteristic.SecuritySystemTargetState,
          this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM);

        this.platform.log.debug('Pushed updated current Security System state to HomeKit:', 'Night Arm');
      });
    }

    setInterval(() => {
      this.device.subscribe();
    }, this.platform.interval);

    this.accessory.updateReachability(true);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Security System.
   */
  setSecuritySystemTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    switch (value) {
      case this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM:
        this.device.setMode(this.platform.stayArm, () => {
          this.device.emit(this.platform.stayArm);
        });
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM:
        this.device.arm(() => {
          this.device.emit(Arlo.ARMED);
        });
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        this.device.arm(this.platform.nightArm, () => {
          this.device.emit(this.platform.nightArm);
        });
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.DISARM:
        this.device.disarm(() => {
          this.device.emit(Arlo.DISARMED);
        });
        break;
    }

    this.platform.log.debug('Set Characteristic Security System Target State ->', value);

    // you must call the callback function
    callback(null);
  }

}