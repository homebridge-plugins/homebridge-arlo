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

export const API_DOMAIN = 'myapi.arlo.com';
export const ARLO_URLS: any = {};

// URL's
ARLO_URLS.API_ROOT = `https://${API_DOMAIN}`;
ARLO_URLS.BASE_URL = 'my.arlo.com';
ARLO_URLS.WEB = `${ARLO_URLS.API_ROOT}/hmsweb`;
ARLO_URLS.LOGOUT = `${ARLO_URLS.WEB}/logout`;
ARLO_URLS.WEB_CLIENT = `${ARLO_URLS.WEB}/client`;
ARLO_URLS.SUBSCRIBE = `${ARLO_URLS.WEB_CLIENT}/subscribe`;
ARLO_URLS.UNSUBSCRIBE = `${ARLO_URLS.WEB_CLIENT}/unsubscribe`;
ARLO_URLS.WEB_USERS = `${ARLO_URLS.WEB}/users`;
ARLO_URLS.DEVICES_V2 = `${ARLO_URLS.WEB}/v2/users/devices`;
ARLO_URLS.DEVICES = `${ARLO_URLS.WEB_USERS}/devices`;
ARLO_URLS.DEVICE = `${ARLO_URLS.WEB_USERS}/device`;
ARLO_URLS.AUTOMATIONACTIVE = `${ARLO_URLS.DEVICES}/automation/active`;
ARLO_URLS.SERVICE_LEVEL_SETTINGS = `${ARLO_URLS.WEB_USERS}/serviceLevel/settings`;
ARLO_URLS.SERVICE_LEVELS = `${ARLO_URLS.WEB_USERS}/serviceLevel/v4`;
ARLO_URLS.CAPABILITIES = `${ARLO_URLS.WEB_USERS}/capabilities`;
ARLO_URLS.FEATURES = `${ARLO_URLS.WEB_USERS}/subscription/smart/features`;
ARLO_URLS.EMERGENCY_LOCATIONS = `${ARLO_URLS.WEB_USERS}/emergency/locations`;
ARLO_URLS.NOTIFY = `${ARLO_URLS.DEVICES}/notify`;
ARLO_URLS.START_STREAM = `${ARLO_URLS.DEVICES}/startStream`;
ARLO_URLS.STOP_STREAM = `${ARLO_URLS.DEVICES}/stopStream`;
ARLO_URLS.SNAPSHOT = `${ARLO_URLS.DEVICES}/fullFrameSnapshot`;
ARLO_URLS.LIBRARY_SUMMARY = `${ARLO_URLS.WEB_USERS}/library/metadata`;
ARLO_URLS.LIBRARY = `${ARLO_URLS.WEB_USERS}/library`;
ARLO_URLS.START_NEW_SESSION = `https://${API_DOMAIN}/hmsweb/users/session/v2`;

// Events
export const EVENT_LOGGED_IN = 'logged_in';
export const EVENT_MESSAGE = 'message';
export const EVENT_CONNECTED = 'connected';
export const EVENT_FF_SNAPSHOT_AVAILABLE = 'fullFrameSnapshotAvailable';
export const EVENT_MEDIA_UPLOAD = 'mediaUploadNotification';
export const EVENT_FOUND = 'device_found';
export const EVENT_GOT_DEVICES = 'got_all_devices';
export const EVENT_MODE = 'activeAutomations';
export const EVENT_SIREN = 'siren';
export const EVENT_DEVICES = 'devices';
export const EVENT_BATTERY = 'batteryLevel';
export const EVENT_DEVICE_UPDATE = 'deviceUpdate';
export const EVENT_LOGOUT = 'logout';
export const EVENT_RATLS = 'storage/ratls';
export const EVENT_PROPERTIES = 'properties_updated';

// Device Types
export const TYPE_ARLOQS = 'arloqs';
export const TYPE_ARLOQ = 'arloq';
export const TYPE_BASESTATION = 'basestation';
export const TYPE_CAMERA = 'camera';