import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { address, isV4Format } from 'ip';
import { spawn } from 'child_process';

import {
  CameraStreamingOptions,
  LegacyCameraSource,
  NodeCallback,
  PlatformAccessory,
  PreparedStreamRequestCallback,
  PrepareStreamRequest,
  PrepareStreamResponse,
  Service,
  SessionIdentifier,
  SnapshotRequest,
  StreamController,
  StreamRequest,
  StreamRequestTypes,
} from 'homebridge';

import { FRAMES_PER_SECOND, DEFAULT_MAX_STREAMS } from '../settings';
import { ArloPlatform } from '../platform';

export class ArloCameraSource
  extends EventEmitter
  implements LegacyCameraSource {
  services: Service[] = [];

  streamControllers: StreamController[] = [];

  private readonly device;

  private pendingSessions = {};
  private ongoingSessions = {};

  private lastSnapshot = Date.now() - 300000;

  private maxStreams = DEFAULT_MAX_STREAMS;

  constructor(
    private readonly platform: ArloPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    super();

    this.device = this.accessory.context.device;

    if (this.platform.config.maxStreams) {
      this.maxStreams = this.platform.config.maxStreams;
    }

    const options: CameraStreamingOptions = {
      proxy: false, // Required RTP / RTCP MUX Proxy
      srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
      video: {
        resolutions: [
          [1280, 720, 24],
          [1280, 720, 15],
          [640, 360, 24],
          [640, 360, 15],
          [320, 240, 24],
          [320, 240, 15],
        ],
        codec: {
          profiles: [
            this.platform.api.hap.StreamController.VideoCodecParamProfileIDTypes
              .BASELINE,
            this.platform.api.hap.StreamController.VideoCodecParamProfileIDTypes
              .MAIN,
            this.platform.api.hap.StreamController.VideoCodecParamProfileIDTypes
              .HIGH,
          ],
          levels: [
            this.platform.api.hap.StreamController.VideoCodecParamLevelTypes
              .TYPE3_1,
            this.platform.api.hap.StreamController.VideoCodecParamLevelTypes
              .TYPE3_2,
            this.platform.api.hap.StreamController.VideoCodecParamLevelTypes
              .TYPE4_0,
          ],
        },
      },
      audio: {
        codecs: [
          {
            type: 'OPUS',
            samplerate: 24,
          },
        ],
      },
    };

    for (let i = 0; i < this.maxStreams; i++) {
      const streamController = new this.platform.api.hap.StreamController(
        i,
        options,
        this,
      );

      this.services.push(streamController.service);
      this.streamControllers.push(streamController);
    }
  }

  handleSnapshotRequest(
    request: SnapshotRequest,
    callback: NodeCallback<Buffer>,
  ) {
    this.platform.log.debug('Snapshot requested');
    this.platform.log.info(
      `Snapshot request: Camera ${this.accessory.displayName} [${this.device.id}]`,
    );

    this.device.downloadSnapshot(
      this.device.device.presignedLastImageUrl,
      (data) => {
        this.platform.log.info(
          `Snapshot downloaded: Camera ${this.accessory.displayName} [${this.device.id}]`,
        );
        callback(null, data);
      },
    );
  }

  prepareStream(
    request: PrepareStreamRequest,
    callback: PreparedStreamRequestCallback,
  ) {
    this.platform.log.debug('Prepare stream request');

    this.device.getStream((streamUrl) => {
      this.platform.log.debug(`Preparing stream fro URL: ${streamUrl}`);
      this.platform.log.debug(`Prepare Stream request: ${request}`);

      const currentAddress = address();

      const response: PrepareStreamResponse = {
        address: {
          address: currentAddress,
        },
        video: {
          port: 0,
          ssrc: 0,
        },
      };

      const session: Record<string, unknown> = {
        streamUrl: streamUrl,
        address: request.targetAddress,
      };

      if (isV4Format(currentAddress)) {
        response.address = {
          address: currentAddress,
          type: 'v4',
        };
      } else {
        response.address = {
          address: currentAddress,
          type: 'v6',
        };
      }

      if (request.video) {
        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = randomBytes(4);
        ssrcSource[0] = 0;
        const ssrc = ssrcSource.readInt32BE(0);

        response.video = {
          port: request.video.port,
          ssrc: ssrc,
          srtp_key: request.video.srtp_key,
          srtp_salt: request.video.srtp_salt,
        };

        session.videoPort = request.video.port;
        session.videoSrtp = Buffer.concat([
          request.video.srtp_key,
          request.video.srtp_salt,
        ]);
        session.videoSsrc = ssrc;
      }

      if (request.audio) {
        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = randomBytes(4);
        ssrcSource[0] = 0;
        const ssrc = ssrcSource.readInt32BE(0);

        response.audio = {
          port: request.audio.port,
          ssrc: ssrc,
          srtp_key: request.audio.srtp_key,
          srtp_salt: request.audio.srtp_salt,
        };

        session.audioPort = request.audio.port;
        session.audioSrtp = Buffer.concat([
          request.audio.srtp_key,
          request.audio.srtp_salt,
        ]);
        session.audioSsrc = ssrc;
      }

      const sessionKey = this.platform.api.hap.uuid.unparse(request.sessionID);

      this.pendingSessions[sessionKey] = session;

      callback(response);
    });
  }

  handleStreamRequest(request: StreamRequest) {
    this.platform.log.debug(`Handle Stream Request: ${request}`);

    if (request.sessionID) {
      const sessionId = this.platform.api.hap.uuid.unparse(request.sessionID);

      switch (request.type) {
        case StreamRequestTypes.START:
          this.streamRequestStart(sessionId, request);
          break;
        case StreamRequestTypes.STOP:
          this.streamRequestStop(sessionId);
          break;
      }
    }
  }

  handleCloseConnection(connectionID: SessionIdentifier) {
    for (const streamController of this.streamControllers) {
      streamController.handleCloseConnection(connectionID);
    }
  }

  private streamRequestStart(sessionId: string, request: StreamRequest) {
    const session = this.pendingSessions[request.sessionID];

    let videoDecoder = '';
    let videoEncoder = 'copy';
    let scaleCommand = '';
    let videoBitrate = 1500;

    if (request.video) {
      if (request.video.width === 1280 && request.video.height === 720) {
        // No video transcoding required, use copy codec
        this.platform.log.debug('No change to video stream size required');
      } else {
        // Scale video requested, requiring video transcoding
        if (this.platform.config.videoDecoder) {
          videoDecoder = `-c:v ${this.platform.config.videoDecoder}`;
          videoEncoder = this.platform.config.videoEnccoder;
          scaleCommand = `-vf scale=${request.video.width}:${request.video.height}`;
        }
      }

      if (request.video.max_bit_rate < videoBitrate) {
        videoBitrate = request.video.max_bit_rate;
      }
    }

    if (session) {
      // Video
      const ffmpegCommandParts = [
        '-rtsp_transport tcp',
        videoDecoder,
        '-re',
        `-i ${session.streamUrl}`,
        '-map 0:0',
        `-c:v ${videoEncoder}`,
        '-pix_fmt yuv420p',
        `-r ${FRAMES_PER_SECOND}`,
        '-f rawvideo',
        scaleCommand,
        this.platform.config.additionalVideoCommands,
        `-b:v ${videoBitrate}k`,
        `-bufsize ${videoBitrate}k`,
        `-maxrate ${videoBitrate}k`,
        '-payload_type 99',
        `-ssrc ${session.videoSsrc}`,
        '-f rtp',
        '-srtp_out_suite AES_CM_128_HMAC_SHA1_80',
        `-srtp_out_params ${session.videoSrtp.toString('base64')}`,
        `srtp://${session.address}:${session.videoPort}` +
          `?rtcpport=${session.videoPort}&localrtcpport=${session.videoPort}&pkt_size=${this.platform.config.packetSize}`,
      ];
      const ffmpegCommand = ffmpegCommandParts.join(' ');

      const ffmpeg = spawn(
        this.platform.config.videoProcessor,
        ffmpegCommand.split(' '),
        { env: process.env },
      );
      this.platform.log.debug(
        `Start streaming video with ${request.video?.width}x${request.video?.height}@${videoBitrate}kBit`,
      );
      this.platform.log.debug(`ffmpeg ${ffmpegCommand}`);

      // Always setup hook on stderr.
      // Without this streaming stops within one to two miinutes.
      ffmpeg.stderr.on('data', (data) => {
        this.platform.log.debug(data.toString());
      });

      ffmpeg.on('close', (code) => {
        if (!code || code === 0 || code === 255) {
          this.platform.log.debug(`Stopped streaming with code ${code}`);
        } else {
          this.platform.log.error(`Error: FFmpeg exited with code ${code}`);

          for (const streamController of this.streamControllers) {
            if (streamController.sessionIdentifier === sessionId) {
              streamController.forceStop();
            }
          }
        }
      });

      // Add to ongoing sessions now that it's been started
      this.ongoingSessions[sessionId] = ffmpeg;
    }

    // Remove from pending sessions
    delete this.pendingSessions[sessionId];
  }

  private streamRequestStop(sessionId: string) {
    const ffmpeg = this.ongoingSessions[sessionId];

    if (ffmpeg) {
      ffmpeg.kill('SIGTERM');
    }
  }
}
