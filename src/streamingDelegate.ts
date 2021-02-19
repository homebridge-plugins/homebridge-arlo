import ip from 'ip';
import { ChildProcess, spawn } from 'child_process';

import {
  CameraController,
  CameraStreamingDelegate,
  PlatformAccessory,
  PrepareStreamCallback,
  PrepareStreamRequest,
  PrepareStreamResponse,
  SnapshotRequest,
  SnapshotRequestCallback,
  SRTPCryptoSuites,
  StartStreamRequest,
  StreamingRequest,
  StreamRequestCallback,
  StreamRequestTypes,
  StreamSessionIdentifier,
  VideoInfo,
} from 'homebridge';
import { default as ffmpegPath } from 'ffmpeg-for-homebridge';

import { ArloHomebridgePlatform } from './platform';

import { Responses } from 'node-arlo';

type SessionInfo = {
    
  /**
   * address of the HAP controller.
   */
  address: string,

  videoPort: number,

  /**
   * Should be saved if multiple suites are supported.
   */
  videoCryptoSuite: SRTPCryptoSuites,

  /**
   * Key and salt concatenated.
   */
  videoSRTP: Buffer,

  /**
   * RTP synchronisation source.
   */
  videoSSRC: number,

  audioPort: number,

  /**
   * Should be saved if multiple suites are supported.
   */
  audioCryptoSuite: SRTPCryptoSuites,

  /**
   * Key and salt concatenated.
   */
  audioSRTP: Buffer,

  /**
   * RTP synchronisation source.
   */
  audioSSRC: number,

  /**
   * Start stream data.
   */
  stream: Responses.StartStreamData
}

const FFMPEGH264ProfileNames = [
  'baseline',
  'main',
  'high',
];

const FFMPEGH264LevelNames = [
  '3.1',
  '3.2',
  '4.0',
];

export class ArloFFMPEGStreamingDelegate implements CameraStreamingDelegate {

  private ffmpegDebugOutput = false;

  controller?: CameraController;

  /**
   * Keep track of sessions.
   */
  pendingSessions: Record<string, SessionInfo> = {};
  ongoingSessions: Record<string, ChildProcess> = {};

  constructor(
    private readonly platform: ArloHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {}

  async handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback) {
    let snapshot = false;
    try {
      snapshot = await this.accessory.context.device.getSnapshot();
    } catch (error) {
      this.platform.log.debug(error);
      callback(new Error(error));
    }

    if (snapshot) {
      this.platform.log.debug('Successfully captured snapshot.');
      callback(undefined);
    } else {
      this.platform.log.debug('Snapshot unsuccessful');
      callback(new Error('Snapshot unsuccessful.'));
    }
  }

  /**
   * Called when request RTP setup.
   * @param request Request.
   * @param callback Callback.
   */
  async prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback) {
    let stream: Responses.StartStreamData | null = null;
    try {
      stream = await this.accessory.context.device.getStream();
    } catch (error) {
      this.platform.log.debug(error);
      callback(new Error(error));
    }

    if (!stream) {
      callback(new Error('Stream unsuccesful.'));
      return;
    }

    const sessionId: StreamSessionIdentifier = request.sessionID;
    const targetAddress = request.targetAddress;

    const video = request.video;
    const videoPort = video.port;

    const audio = request.audio;
    const audioPort = audio.port;

    /**
     * Could be used to support multiple crypto suite (or support no suite for debugging).
     */
    const videoCryptoSuite = video.srtpCryptoSuite;
    const videoSrtpKey = video.srtp_key;
    const videoSrtpSalt = video.srtp_salt;

    const audioCryptoSuite = audio.srtpCryptoSuite;
    const audioSrtpKey = audio.srtp_key;
    const audioSrtpSalt = audio.srtp_salt;

    const videoSSRC = this.platform.api.hap.CameraController.generateSynchronisationSource();

    const audioSSRC = this.platform.api.hap.CameraController.generateSynchronisationSource();

    const sessionInfo: SessionInfo = {
      address: targetAddress,

      videoPort: videoPort,
      videoCryptoSuite: videoCryptoSuite,
      videoSRTP: Buffer.concat([videoSrtpKey, videoSrtpSalt]),
      videoSSRC: videoSSRC,

      audioPort: audioPort,
      audioCryptoSuite: audioCryptoSuite,
      audioSRTP: Buffer.concat([audioSrtpKey, audioSrtpSalt]),
      audioSSRC: audioSSRC,

      stream: stream,
    };

    /**
     * IP address version must match.
     */
    const currentAddress = ip.address('public', request.addressVersion);
    const response: PrepareStreamResponse = {
      address: currentAddress,
      video: {
        port: videoPort,
        ssrc: videoSSRC,

        srtp_key: videoSrtpKey,
        srtp_salt: videoSrtpSalt,
      },
      audio: {
        port: audioPort,
        ssrc: audioSSRC,

        srtp_key: audioSrtpKey,
        srtp_salt: audioSrtpSalt,
      },
    };

    this.pendingSessions[sessionId] = sessionInfo;
    callback(undefined, response);
  }

  /**
   * Calledd when device asks stream to start / stop / reconfigure.
   * @param request Request.
   * @param callback Callback.
   */
  handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void {
    const sessionId = request.sessionID;

    switch (request.type) {
      case StreamRequestTypes.START:
        this.startStreamRequest(sessionId, request, callback);
        break;
      case StreamRequestTypes.RECONFIGURE:
        // Not supported.
        this.platform.log.debug('Received (unsupported) request to reconfigure to:', JSON.stringify(request.video));
        callback();
        break;
      case StreamRequestTypes.STOP:
        this.stopStreamRequest(sessionId, callback);
        break;
    }
  }

  /**
   * Start stream request.
   * @param sessionId Session ID.
   * @param request Request.
   * @param callback Callback.
   */
  private startStreamRequest(sessionId: string, request: StartStreamRequest, callback: StreamRequestCallback) {
    const sessionInfo = this.pendingSessions[sessionId];

    const video: VideoInfo = request.video;

    const profile = FFMPEGH264ProfileNames[video.profile];
    const level = FFMPEGH264LevelNames[video.level];
    const width = video.width;
    const height = video.height;
    const fps = video.fps;

    const payloadType = video.pt;
    const maxBitrate = video.max_bit_rate;

    /**
     * Maximum transmission unit.
     */
    const mtu = video.mtu;

    const address = sessionInfo.address;
    const videoPort = sessionInfo.videoPort;
    const ssrc = sessionInfo.videoSSRC;
    const cryptoSuite = sessionInfo.videoCryptoSuite;
    const videoSRTP = sessionInfo.videoSRTP.toString('base64');

    this.platform.log.debug(`Starting video stream (${width}x${height}, ${fps} fps, ${maxBitrate} kbps, ${mtu} mtu)...`);

    let videoffmpegCommand = `-rtsp_transport tcp -re -i ${sessionInfo.stream.url} -map 0:0 -c:v libx264 -pix_fmt yuv420p -r ${fps} ` +
      `-f rawvideo -vf scale=${width}:${height} -b:v ${maxBitrate}k -bufsize ${2 * maxBitrate}k -maxrate ${maxBitrate}k ` +
      `-payload_type ${payloadType} -ssrc ${ssrc} -f rtp `;
    // -profile:v ${profile} -level:v ${level}

    // Actually ffmpeg just supports AES_CM_128_HMAC_SHA1_80.
    if (cryptoSuite === SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80) {
      videoffmpegCommand += `-srtp_out_suite AES_CM_128_HMAC_SHA1_80 -srtp_out_params ${videoSRTP} s`;
    }

    videoffmpegCommand += `rtp://${address}:${videoPort}?rtcpport=${videoPort}&localrtcpport=${videoPort}&pkt_size=${mtu}`;

    let ffmpegBin = 'ffmpeg';

    if (ffmpegPath) {
      ffmpegBin = ffmpegPath;
    }

    if (this.ffmpegDebugOutput) {
      this.platform.log.debug(`FFMPEG command: ${ffmpegBin} ${videoffmpegCommand}`);
    }

    const ffmpegVideo = spawn(ffmpegBin, videoffmpegCommand.split(' '), {env: process.env});

    let started = false;
    ffmpegVideo.stderr.on('data', data => {
      if (!started) {
        started = true;
        this.platform.log.debug('FFMPEG: received first frame');

        callback(); // Do not forget to execute callback once set up.
      }

      if (this.ffmpegDebugOutput) {
        this.platform.log.debug(`VIDEO: ${String(data)}`);
      }
    });
    ffmpegVideo.on('error', error => {
      this.platform.log.debug(`[Video] Failed to start video stream: ${error.message}`);
      callback(new Error('ffmpeg process creation failed!'));
    });
    ffmpegVideo.on('exit', (code, signal) => {
      const message = `[Video] ffmpeg exited with code: ${code} and signal: ${signal}`;

      if (code === null || code === 255) {
        this.platform.log.debug(message, '(Video stream stopped!)');
      } else {
        this.platform.log.debug(message, '(error)');

        if (!started) {
          callback(new Error(message));
        } else {
          this.controller!.forceStopStreamingSession(sessionId);
        }
      }
    });

    this.ongoingSessions[sessionId] = ffmpegVideo;
    delete this.pendingSessions[sessionId];
  }

  /**
   * Stop stream request.
   * @param sessionId Session ID.
   */
  private stopStreamRequest(sessionId: string, callback: StreamRequestCallback) {
    const ffmpegProcess = this.ongoingSessions[sessionId];

    try {
      if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
      }
    } catch (e) {
      this.platform.log.debug('Error occurred terminating the video process!');
      this.platform.log.debug(e);
    }

    delete this.ongoingSessions[sessionId];

    this.platform.log.debug('Stopped streaming session!');
    callback();
  }

}