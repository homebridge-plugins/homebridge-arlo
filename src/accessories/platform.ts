import { PlatformAccessory } from 'homebridge';

import { MANUFACTURER } from '../settings';
import { ArloPlatform } from '../platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export abstract class ArloPlatformAccessory {
  protected readonly device;

  constructor(
    protected readonly platform: ArloPlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    this.device = this.accessory.context.device;

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        MANUFACTURER,
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        this.device.getModel(),
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.device.getSerialNumber(),
      )
      .setCharacteristic(
        this.platform.Characteristic.Name,
        this.device.getName(),
      );
  }
}
