import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';

import { ArloHomebridgePlatform } from '../platform';
import { ArloPlatformAccessory } from './platform';
import { getBugsUrl } from '../package';

/**
 * Basestation platform accessory.
 * An instance of this class is created for each basestation accessory our platform registers.
 * Each accessory may expose multiple services of different service types.
 */
export class BasestationPlatformAccessory extends ArloPlatformAccessory {
  private service: Service;

  constructor(
    protected readonly platform: ArloHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {

    super(platform, accessory);

    // Fet the Security system service if it exists, otherwise create a new Security system service.
    this.service =
      this.accessory.getService(this.platform.Service.SecuritySystem)
      || this.accessory.addService(this.platform.Service.SecuritySystem);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/SeccuritySystem

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .on('set', this.setSecuritySystemTargetState.bind(this)); // SET - bind to the `setSecuritySystemTargetState` method below

    // Update the state of a Characteristic asynchronously instead
    // of using the `on('get')` handlers.
    //
    // Here we update the security system current and target state using
    // the `updateCharacteristic` method.
    this.accessory.context.device.on('mode', (activeMode) => {
      // Assign the current and target security system state
      let currentSecuritySystemState: CharacteristicValue | null = null;
      let targetSecuritySystemState: CharacteristicValue | null = null;
      switch (activeMode) {
        case 'mode0':
          currentSecuritySystemState = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
          targetSecuritySystemState = this.platform.Characteristic.SecuritySystemTargetState.DISARM;
          break;
        case 'mode1':
          currentSecuritySystemState = this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
          targetSecuritySystemState = this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM;
          break;
      }

      if (this.platform.config.stayArm && activeMode === this.platform.config.stayArm) {
        currentSecuritySystemState = this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM;
        targetSecuritySystemState = this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM;
      }

      if (this.platform.config.nightArm && activeMode === this.platform.config.nightArm) {
        currentSecuritySystemState = this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
        targetSecuritySystemState = this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM;
      }

      if (currentSecuritySystemState) {
        // Push the new value to HomeKit.
        this.service.updateCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState, currentSecuritySystemState);

        this.platform.log.debug('Pushed updated current Security system state to HomeKit:', currentSecuritySystemState);
      }

      if (targetSecuritySystemState) {
        // Push the new value to HomeKit.
        this.service.updateCharacteristic(this.platform.Characteristic.SecuritySystemTargetState, targetSecuritySystemState);

        this.platform.log.debug('Pushed updated target Security system state to HomeKit:', targetSecuritySystemState);
      }
    });
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, arming a Security system.
   */
  async setSecuritySystemTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    let mode: string | null = null;
    switch (value) {
      case this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM:
        mode = this.platform.config.stayArm;
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM:
        mode = 'mode1';
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        mode = this.platform.config.nightArm;
        break;
      case this.platform.Characteristic.SecuritySystemTargetState.DISARM:
        mode = 'mode0';
        break;
      default:
        this.platform.log.warn('Security system target state not implemented:', value);
        this.platform.log.warn('Open a feature request if required:', getBugsUrl());
        callback(new Error('Security system target state not implemented.'), value);
        return;
    }

    if (mode) {
      try {
        await this.accessory.context.device.setMode(mode);

        this.platform.log.debug('Set Characteristic Security system target state ->', value);
    
        // We must call the callback function.
        callback(null);
      } catch (error) {
        this.platform.log.error('Error setting Characteristic Security system target state ->', value, error);

        // We must call the callback function.
        callback(new Error(error), value);
      }
    } else {
      this.platform.log.error('Error setting Characteristic Security system target state ->', value);

      // We must call the callback function.
      callback(new Error('Error setting Characteristic Security system target state'), value);
    }
  }

}