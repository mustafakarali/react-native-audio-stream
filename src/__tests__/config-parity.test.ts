import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import {
  AudioFormat,
  StreamingProtocol,
  PlaybackState,
  LogLevel,
  EQUALIZER_PRESETS,
  type AudioStreamConfig,
} from '../types';

/**
 * Config parity tests:
 * Verify every TypeScript config field is passed through to native module.
 * No field should be silently dropped.
 */

describe('Config Field Parity', () => {
  let audioStream: AudioStream;
  let mockNativeModule: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    mockNativeModule = NativeModules.RNAudioStream;
  });

  describe('All config fields passed to native', () => {
    it('should pass complete config with all fields to native initialize', async () => {
      const fullConfig: AudioStreamConfig = {
        // Buffer
        bufferSize: 128,
        prebufferThreshold: 32,
        maxBufferSize: 1024,
        // Stream
        chunkSize: 32,
        protocol: StreamingProtocol.HTTPS,
        reconnectAttempts: 5,
        reconnectDelay: 2000,
        timeout: 15000,
        // Audio
        format: AudioFormat.AAC,
        sampleRate: 48000,
        channels: 1,
        bitRate: 320,
        // Playback
        autoPlay: false,
        enableBackgroundMode: true,
        maintainAudioFocus: false,
        // Cache
        enableCache: true,
        cacheSize: 200,
        cachePath: '/custom/cache',
        // Logging
        logLevel: LogLevel.VERBOSE,
        // HTTP
        headers: { 'Authorization': 'Bearer token123' },
        method: 'POST',
        body: { key: 'value' },
        // iOS-specific
        enableRecording: true,
        voiceProcessing: true,
        spokenAudio: true,
        longFormAudio: true,
        enableAirPodsHighQuality: true,
        enableEnhancedBuffering: true,
        enableSpatialAudio: true,
      };

      await audioStream.initialize(fullConfig);

      const passedConfig = mockNativeModule.initialize.mock.calls[0][0];

      // Buffer
      expect(passedConfig.bufferSize).toBe(128);
      expect(passedConfig.prebufferThreshold).toBe(32);
      expect(passedConfig.maxBufferSize).toBe(1024);

      // Stream
      expect(passedConfig.chunkSize).toBe(32);
      expect(passedConfig.protocol).toBe('https');
      expect(passedConfig.reconnectAttempts).toBe(5);
      expect(passedConfig.reconnectDelay).toBe(2000);
      expect(passedConfig.timeout).toBe(15000);

      // Audio
      expect(passedConfig.format).toBe('aac');
      expect(passedConfig.sampleRate).toBe(48000);
      expect(passedConfig.channels).toBe(1);
      expect(passedConfig.bitRate).toBe(320);

      // Playback
      expect(passedConfig.autoPlay).toBe(false);
      expect(passedConfig.enableBackgroundMode).toBe(true);
      expect(passedConfig.maintainAudioFocus).toBe(false);

      // Cache
      expect(passedConfig.enableCache).toBe(true);
      expect(passedConfig.cacheSize).toBe(200);
      expect(passedConfig.cachePath).toBe('/custom/cache');

      // Logging
      expect(passedConfig.logLevel).toBe(LogLevel.VERBOSE);

      // HTTP
      expect(passedConfig.headers).toEqual({ 'Authorization': 'Bearer token123' });
      expect(passedConfig.method).toBe('POST');
      expect(passedConfig.body).toEqual({ key: 'value' });

      // iOS-specific
      expect(passedConfig.enableRecording).toBe(true);
      expect(passedConfig.voiceProcessing).toBe(true);
      expect(passedConfig.spokenAudio).toBe(true);
      expect(passedConfig.longFormAudio).toBe(true);
      expect(passedConfig.enableAirPodsHighQuality).toBe(true);
      expect(passedConfig.enableEnhancedBuffering).toBe(true);
      expect(passedConfig.enableSpatialAudio).toBe(true);
    });
  });

  describe('Default values', () => {
    it('should apply correct defaults for all fields when empty config', async () => {
      await audioStream.initialize({});

      const passedConfig = mockNativeModule.initialize.mock.calls[0][0];

      // Buffer defaults
      expect(passedConfig.bufferSize).toBe(64);
      expect(passedConfig.prebufferThreshold).toBe(16);
      expect(passedConfig.maxBufferSize).toBe(512);

      // Stream defaults
      expect(passedConfig.chunkSize).toBe(16);
      expect(passedConfig.protocol).toBe('https');
      expect(passedConfig.reconnectAttempts).toBe(3);
      expect(passedConfig.reconnectDelay).toBe(1000);
      expect(passedConfig.timeout).toBe(30000);

      // Audio defaults — format is intentionally undefined (auto-detected from URL)
      expect(passedConfig.format).toBeUndefined();
      expect(passedConfig.sampleRate).toBe(44100);
      expect(passedConfig.channels).toBe(2);
      expect(passedConfig.bitRate).toBeUndefined(); // no default, depends on stream

      // Playback defaults
      expect(passedConfig.autoPlay).toBe(true);
      expect(passedConfig.enableBackgroundMode).toBe(false);
      expect(passedConfig.maintainAudioFocus).toBe(true);

      // Cache defaults
      expect(passedConfig.enableCache).toBe(false);
      expect(passedConfig.cacheSize).toBe(100);

      // iOS fields — undefined when not explicitly set (platform handles defaults)
      expect(passedConfig.enableRecording).toBeUndefined();
      expect(passedConfig.voiceProcessing).toBeUndefined();
      expect(passedConfig.spokenAudio).toBeUndefined();
      expect(passedConfig.longFormAudio).toBeUndefined();
    });
  });

  describe('StreamingProtocol enum', () => {
    it('should not have unsupported protocols', () => {
      // All protocol values must have real native implementation
      expect(StreamingProtocol.HTTP).toBe('http');
      expect(StreamingProtocol.HTTPS).toBe('https');
      expect(StreamingProtocol.WEBSOCKET).toBe('websocket');
      expect(StreamingProtocol.WEBSOCKET_SECURE).toBe('wss');
    });

    it('should have HTTP, HTTPS, WEBSOCKET, and WEBSOCKET_SECURE', () => {
      const values = Object.values(StreamingProtocol);
      expect(values).toContain('http');
      expect(values).toContain('https');
      expect(values).toContain('websocket');
      expect(values).toContain('wss');
      expect(values).toHaveLength(4);
    });
  });

  describe('Equalizer presets', () => {
    it('should have at least 5 presets', () => {
      expect(EQUALIZER_PRESETS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have 5 bands per preset with valid gain range', () => {
      EQUALIZER_PRESETS.forEach((preset) => {
        expect(preset.bands).toHaveLength(5);
        preset.bands.forEach((band) => {
          expect(band.frequency).toBeGreaterThan(0);
          expect(band.gain).toBeGreaterThanOrEqual(-12);
          expect(band.gain).toBeLessThanOrEqual(12);
        });
      });
    });

    it('should have unique preset names', () => {
      const names = EQUALIZER_PRESETS.map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('PlaybackState enum', () => {
    it('should have all 8 states', () => {
      expect(PlaybackState.IDLE).toBe('idle');
      expect(PlaybackState.LOADING).toBe('loading');
      expect(PlaybackState.BUFFERING).toBe('buffering');
      expect(PlaybackState.PLAYING).toBe('playing');
      expect(PlaybackState.PAUSED).toBe('paused');
      expect(PlaybackState.STOPPED).toBe('stopped');
      expect(PlaybackState.ERROR).toBe('error');
      expect(PlaybackState.COMPLETED).toBe('completed');
      expect(Object.values(PlaybackState)).toHaveLength(8);
    });
  });

  describe('AudioFormat enum', () => {
    it('should have all 8 formats', () => {
      expect(AudioFormat.MP3).toBe('mp3');
      expect(AudioFormat.AAC).toBe('aac');
      expect(AudioFormat.WAV).toBe('wav');
      expect(AudioFormat.OGG).toBe('ogg');
      expect(AudioFormat.FLAC).toBe('flac');
      expect(AudioFormat.PCM).toBe('pcm');
      expect(AudioFormat.HLS).toBe('hls');
      expect(AudioFormat.DASH).toBe('dash');
      expect(Object.values(AudioFormat)).toHaveLength(8);
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.NONE).toBe(0);
      expect(LogLevel.ERROR).toBe(1);
      expect(LogLevel.WARNING).toBe(2);
      expect(LogLevel.INFO).toBe(3);
      expect(LogLevel.DEBUG).toBe(4);
      expect(LogLevel.VERBOSE).toBe(5);
    });
  });
});
