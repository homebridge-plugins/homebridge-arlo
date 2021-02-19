import { PlatformAccessory } from 'homebridge';

import { DEFAULT_MANUFACTURER, DEFULAT_APP_MATCHING_IDENTIFIER } from '../settings';
import { ArloHomebridgePlatform } from '../platform';

/**
 * Arlo platform accessory.
 * An instance of this class is created for each accessory our platform registers.
 * Each accessory may expose multiple services of different service types.
 */
export abstract class ArloPlatformAccessory {
  constructor(
    protected readonly platform: ArloHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {

    // Set accessory information.
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, DEFAULT_MANUFACTURER)
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.modelId)
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.device.name)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.id)
      .setCharacteristic(this.platform.Characteristic.AppMatchingIdentifier, DEFULAT_APP_MATCHING_IDENTIFIER)
      .setCharacteristic(this.platform.Characteristic.HardwareRevision, this.accessory.context.device.hardwareVersion);

    if (this.accessory.context.device.firmwareVersion) {
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.accessory.context.device.firmwareVersion);
    }

    // Update the state of a Characteristic asynchronously instead
    // of using the `on('get')` handlers.
    //
    // Here we update the security system current and target state using
    // the `updateCharacteristic` method.
    this.accessory.context.device.on('modelId', (modelId: string) => {
      // Push the new value to HomeKit.
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .updateCharacteristic(this.platform.Characteristic.Model, modelId);

      this.platform.log.debug('Pushed updated current Model to HomeKit:', modelId);


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

}