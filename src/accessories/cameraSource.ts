import { EventEmitter } from 'events';

import {
  CameraStreamingOptions,
  LegacyCameraSource,
  NodeCallback,
  PlatformAccessory,
  PreparedStreamRequestCallback,
  PrepareStreamRequest,
  Service,
  SessionIdentifier,
  SnapshotRequest,
  StreamController,
  StreamRequest,
} from 'homebridge';

import { ArloPlatform } from '../platform';

import { Arlo } from 'node-arlo';

export class ArloCameraSource extends EventEmitter implements LegacyCameraSource {
  services: Service[] = [];

  streamControllers: StreamController[] = [];

  private readonly device;

  private lastSnapshot = Date.now() - 300000;

  constructor(
    private readonly platform: ArloPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    super();

    this.device = this.accessory.context.device;

    const options: CameraStreamingOptions = {
      proxy: false, // Required RTP / RTCP MUX Proxy
      srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
      video: {
        resolutions: [
          [1280, 720, 30],
          [1280, 720, 15],
          [640, 360, 30],
          [640, 360, 15],
          [320, 240, 30],
          [320, 240, 15],
        ],
        codec: {
          profiles: [this.platform.api.hap.StreamController.VideoCodecParamProfileIDTypes.MAIN],
          levels: [this.platform.api.hap.StreamController.VideoCodecParamLevelTypes.TYPE4_0],
        },
      },
      audio: {
        codecs: [
          {
            type: 'OPUS',
            samplerate: 16,
          },
        ],
      },
    };

    const streamController = new this.platform.api.hap.StreamController(1, options, this);

    this.services['streamController'] = streamController.service;
    this.streamControllers.push(streamController);
  }

  handleSnapshotRequest(request: SnapshotRequest, callback: NodeCallback<Buffer>) {
    const now = Date.now();

    if (now < this.lastSnapshot + 300000) {
      this.platform.log.info(`Snapshot skipped: Camera ${this.accessory.displayName} [${this.device.id}] - Next in ${(this.lastSnapshot + 300000 - now) / 1000} seconds`);
      callback(null);
      return;
    }

    this.platform.log.info(`Snapshot request: Camera ${this.accessory.displayName} [${this.device.id}]`);

    this.device.getSnapshot((error, data) => {
      if (error) {
        this.platform.log.error(error);
        callback(error);
        return;
      }

      this.lastSnapshot = now;

      this.platform.log.info(`Snapshot confirmed: Camera ${this.accessory.displayName} [${this.device.id}]`);

      this.device.once(Arlo.FF_SNAPSHOT, (url) => {
        this.device.downloadSnapshot(url, (data) => {
          this.platform.log.info(`Snapshot downloaded: Camera ${this.accessory.displayName} [${this.device.id}]`);
          callback(null, data);
        });
      });
    });
  }

  prepareStream(request: PrepareStreamRequest, callback: PreparedStreamRequestCallback) {
    this.platform.log.debug('prepareStream');
  }

  handleStreamRequest(request: StreamRequest) {
    this.platform.log.debug('handleStreamRequest');
  }

  handleCloseConnection(connectionID: SessionIdentifier) {
    for (const streamController of this.streamControllers) {
      streamController.handleCloseConnection(connectionID);
    }
  }
}