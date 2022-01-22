import * as homebridge from 'homebridge';
import * as platform from './platform';
import * as settings from './settings';

/**
 * This method registers the platform with Homebridge
 */
export = (api: homebridge.API): void => {
  api.registerPlatform(settings.PLATFORM_NAME, platform.ArloPlatform);
};
