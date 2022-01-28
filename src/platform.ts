import { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, Service } from 'homebridge';
import { SwitchBotPlatformConfig } from './settings';
import Arlo from 'arlo-cameras';
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ArloPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(public readonly log: Logger, public readonly config: SwitchBotPlatformConfig, public readonly api: API) {
    this.debugLog(`Finished initializing platform: ${this.config.name}`);
    // only load if configured
    if (!this.config) {
      return;
    }

    // verify the config
    try {
      this.verifyConfig();
      this.debugLog('Config OK');
    } catch (e: any) {
      this.errorLog(JSON.stringify(e.message));
      return;
    }

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      this.debugLog('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      try {
        this.discoverDevices();
      } catch (e: any) {
        this.errorLog(`Failed to Discover Devices ${JSON.stringify(e.message)}`);
        this.errorLog(JSON.stringify(e));
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.infoLog(`Loading accessory from cache: ${accessory.displayName}`);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Verify the config passed to the plugin is valid
   */
  verifyConfig() {
    if (!this.config.arloUser) {
      throw new Error('Must Supply Arlo Username');
    }
    if (!this.config.arloPassword) {
      throw new Error('Must Supply Arlo Username');
    }
    if (!this.config.emailUser) {
      throw new Error('Must Supply Arlo Username');
    }
    if (!this.config.emailUser) {
      throw new Error('Must Supply Arlo Username');
    }
    if (!this.config.emailServer) {
      throw new Error('Must Supply Arlo Username');
    }
  }

  options() {
    const arloUser = this.config.arloUser; // Arlo user
    const arloPassword = this.config.arloPassword; // Arlo password
    const mfa = this.config.mfa; // Arlo MFA
    const emailUser = this.config.emailUser; // Your email address registered to receive MFA
    const emailPassword = this.config.emailUser; // Your email password
    const emailServer = this.config.emailServer; // Email server
    const updatePropertiesEvery = this.config.refreshRate || 5; // Update device information every x minutes

    const options = {
      arloUser,
      arloPassword,
      mfa,
      emailUser,
      emailPassword,
      emailServer,
      updatePropertiesEvery,
    };
    this.infoLog(options);
    return options;
  }

  async logInToArlo() {
    const options = this.options();
    const arlo = new Arlo(options);
    if (arlo instanceof Error) {
      this.errorLog(arlo.message);
      return false;
    }

    this.infoLog('Login to Arlo');
    const sucess = await arlo.login();
    if (!sucess) {
      this.errorLog('Not able to login to Arlo');
      return false;
    }
    this.infoLog('Logged into Arlo');
    return true;
  }

  /**
   * this method discovers devices
   */
  async discoverDevices() {
    try {
      await this.logInToArlo();
      this.infoLog('Discover Devices');
    } catch (error) {
      this.errorLog(`Error ${error}`);
    }
  }

  /**
   * If device level logging is turned on, log to log.warn
   * Otherwise send debug logs to log.debug
   */
  infoLog(...log: any[]) {
    if (this.enablingPlatfromLogging()) {
      this.log.info(String(...log));
    }
  }

  warnLog(...log: any[]) {
    if (this.enablingPlatfromLogging()) {
      this.log.warn(String(...log));
    }
  }

  errorLog(...log: any[]) {
    if (this.enablingPlatfromLogging()) {
      this.log.error(String(...log));
    }
  }

  debugLog(...log: any[]) {
    if (this.enablingPlatfromLogging()) {
      if (this.config.logging === 'debugMode') {
        this.log.debug(String(...log));
      } else if (this.config.logging === 'debug') {
        this.log.info('[DEBUG]', String(...log));
      }
    }
  }

  enablingPlatfromLogging(): boolean {
    return this.config.logging === 'debug' || this.config.logging === 'standard';
  }
}
