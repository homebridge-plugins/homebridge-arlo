/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  Service,
} from "homebridge";
import * as settings from "./settings";

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ArloPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: settings.SwitchBotPlatformConfig,
    public readonly api: API,
  ) {
    this.debugLog("Finished initializing platform:", this.config.name);
    // only load if configured
    if (!this.config) {
      return;
    }

    // verify the config
    try {
      this.verifyConfig();
      this.debugLog("Config OK");
    } catch (e: any) {
      this.errorLog(JSON.stringify(e.message));
      return;
    }

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on("didFinishLaunching", async () => {
      this.debugLog("Executed didFinishLaunching callback");
      // run the method to discover / register your devices as accessories
      try {
        this.discoverDevices();
      } catch (e: any) {
        this.errorLog(
          `Failed to Discover Devices ${JSON.stringify(e.message)}`,
        );
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
    this.config.email;
    this.config.password;
    this.config.logging = "debug";
  }

  /**
   * this method discovers devices
   */
  async discoverDevices() {
    try {
      this.infoLog("Discover Devices");
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
      if (this.config.logging === "debugMode") {
        this.log.debug(String(...log));
      } else if (this.config.logging === "debug") {
        this.log.info("[DEBUG]", String(...log));
      }
    }
  }

  enablingPlatfromLogging(): boolean {
    return (
      this.config.logging === "debug" || this.config.logging === "standard"
    );
  }
}
