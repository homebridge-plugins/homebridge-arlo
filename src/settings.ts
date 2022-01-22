import * as homebridge from 'homebridge';
/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = 'Arlo';

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = 'homebridge-arlo';

/**
 * This is the name of the manufacturer.
 */
export const MANUFACTURER = 'Arlo';

/**
 * This is the name of the manufacturer.
 */
export const APP_MATCHING_IDENTIFIER = 'Arlo';

/**
 * This is the frames per second.
 */
export const FRAMES_PER_SECOND = 24;

/**
 * This is the default maximum number of streams.
 */
export const DEFAULT_MAX_STREAMS = 2;

/**
 * This is the default packet size.
 */
export const DEFAULT_PACKET_SIZE = 1316;

/**
 * This is the default subscribe time.
 */
export const DEFAULT_SUBSCRIBE_TIME = 60000;

/**
 * This is platform configs
 */
export interface SwitchBotPlatformConfig extends homebridge.PlatformConfig {
  arloUser?: string;
  arloPassword?: string;
  mfa?: boolean;
  emailUser?: string;
  emailPassword?: string;
  emailServer?: string;
  refreshRate?: number;
  logging?: string;
}
