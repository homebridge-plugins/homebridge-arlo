import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  AudioStreamingCodecType,
  AudioStreamingSamplerate,
  CameraControllerOptions,
  H264Level,
  H264Profile,
  SRTPCryptoSuites,
} from 'homebridge';

import { ArloHomebridgePlatform } from '../platform';
import { ArloFFMPEGStreamingDelegate } from '../streamingDelegate';
import { ArloPlatformAccessory } from './platform';
import { getBugsUrl } from '../package';

/**
 * Camera platform accessory.
 * An instance of this class is created for each camera accessory our platform registers.
 * Each accessory may expose multiple services of different service types.
 */
export class CameraPlatformAccessory extends ArloPlatformAccessory {
  private service: Record<string, Service> = {};

  constructor(
    protected readonly platform: ArloHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {

    super(platform, accessory);

    const streamingDelegate = new ArloFFMPEGStreamingDelegate(this.platform, this.accessory);

    const options: CameraControllerOptions = {

      /**
       * HomeKit requires at least 2 streams, but 1 is also just fine.
       */
      cameraStreamCount: 2,
      delegate: streamingDelegate,

      streamingOptions: {

        /**
         * NONE is not supported just there for testing.
         */
        supportedCryptoSuites: [SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],

        video: {
          codec: {
            profiles: [H264Profile.BASELINE, H264Profile.MAIN, H264Profile.HIGH],
            levels: [H264Level.LEVEL3_1, H264Level.LEVEL3_2, H264Level.LEVEL4_0],
          },

          /**
           * Width, height, and framerate.
           */
          resolutions: [
            [1280, 720, 24],
            [1280, 720, 15],
            [640, 360, 24],
            [640, 360, 15],
            [320, 240, 24],

            /**
             * Apple Watch requires this configuration (Apple Watch also seems to require OPUS @16K).
             */
            [320, 240, 15],
          ],
        },
        audio: {
          codecs: [{
            type: AudioStreamingCodecType.OPUS,

            /**
             * 16 and 24 must be present for AAC-ELD or OPUS.
             */
            samplerate: [AudioStreamingSamplerate.KHZ_16, AudioStreamingSamplerate.KHZ_24],
          }],
        },
      },
    };

    const cameraController = new this.platform.api.hap.CameraController(options);
    streamingDelegate.controller = cameraController;

    accessory.configureController(cameraController);

    // Get the Camera operating mode service if it exists, otherwise create a new Camera operating modeCamera operating mode service.
    this.service.cameraOperatingMode =
      this.accessory.getService(this.platform.Service.CameraOperatingMode)
      || this.accessory.addService(this.platform.Service.CameraOperatingMode);

    // Get the Battery service if it exists, otherwise create a new Battery service.
    this.service.battery =
      this.accessory.getService(this.platform.Service.BatteryService)
      || this.accessory.addService(this.platform.Service.BatteryService);

    // Get the Motion sensor service if it exists, otherwise create a new Motion sensor service.
    this.service.motionSensor =
      this.accessory.getService(this.platform.Service.MotionSensor)
      || this.accessory.addService(this.platform.Service.MotionSensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.cameraOperatingMode.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/CameraOperatingMode

    // register handlers for the Event snapshots active Characteristic
    this.service.cameraOperatingMode.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
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