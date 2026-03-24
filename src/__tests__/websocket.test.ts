import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import { StreamingProtocol, ErrorCodes } from '../types';
import type { WebSocketStreamConfig } from '../types';

const RNAudioStream = NativeModules.RNAudioStream;

describe('WebSocket Streaming', () => {
  let audioStream: AudioStream;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
  });

  describe('StreamingProtocol enum', () => {
    it('should include WEBSOCKET and WEBSOCKET_SECURE', () => {
      expect(StreamingProtocol.WEBSOCKET).toBe('websocket');
      expect(StreamingProtocol.WEBSOCKET_SECURE).toBe('wss');
    });

    it('should have 4 protocol values', () => {
      const values = Object.values(StreamingProtocol);
      expect(values).toHaveLength(4);
      expect(values).toEqual(expect.arrayContaining(['http', 'https', 'websocket', 'wss']));
    });
  });

  describe('ErrorCodes', () => {
    it('should include INVALID_URL', () => {
      expect(ErrorCodes.INVALID_URL).toBe('INVALID_URL');
    });

    it('should include WEBSOCKET_ERROR', () => {
      expect(ErrorCodes.WEBSOCKET_ERROR).toBe('WEBSOCKET_ERROR');
    });
  });

  describe('WebSocketStreamConfig type', () => {
    it('should accept valid config', () => {
      const config: WebSocketStreamConfig = {
        url: 'wss://example.com/stream',
        sampleRate: 24000,
        channels: 1,
        autoPlay: true,
        autoReconnect: true,
        reconnectAttempts: 5,
        reconnectDelay: 1000,
      };
      expect(config.url).toBe('wss://example.com/stream');
      expect(config.sampleRate).toBe(24000);
      expect(config.channels).toBe(1);
    });

    it('should accept optional fields', () => {
      const config: WebSocketStreamConfig = { url: 'ws://localhost:8080' };
      expect(config.protocols).toBeUndefined();
      expect(config.headers).toBeUndefined();
      expect(config.audioFormat).toBeUndefined();
    });

    it('should accept headers and protocols', () => {
      const config: WebSocketStreamConfig = {
        url: 'wss://voice.example.com',
        protocols: ['audio-stream', 'voip'],
        headers: { 'Authorization': 'Bearer token123' },
      };
      expect(config.protocols).toEqual(['audio-stream', 'voip']);
      expect(config.headers?.Authorization).toBe('Bearer token123');
    });
  });

  describe('startWebSocketStream', () => {
    beforeEach(async () => {
      RNAudioStream.initialize.mockResolvedValueOnce(true);
      await audioStream.initialize();
    });

    it('should call native startWebSocketStream', async () => {
      await audioStream.startWebSocketStream({
        url: 'wss://test.com/stream',
        sampleRate: 24000,
        channels: 1,
      });
      expect(RNAudioStream.startWebSocketStream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'wss://test.com/stream',
          sampleRate: 24000,
          channels: 1,
          autoPlay: true,
          autoReconnect: true,
        })
      );
    });

    it('should throw if not initialized', async () => {
      // Create a fresh stream that hasn't been initialized
      (AudioStream as any).instance = null;
      const freshStream = AudioStream.getInstance();
      // startWebSocketStream checks isInitialized and throws StreamError
      try {
        await freshStream.startWebSocketStream({ url: 'wss://test.com' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('INITIALIZATION_ERROR');
      }
    });

    it('should throw on empty URL', async () => {
      try {
        await audioStream.startWebSocketStream({ url: '' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('INVALID_URL');
      }
    });

    it('should use default values for optional config', async () => {
      await audioStream.startWebSocketStream({ url: 'wss://test.com' });
      expect(RNAudioStream.startWebSocketStream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'wss://test.com',
          protocols: [],
          headers: {},
          audioFormat: 'pcm',
          sampleRate: 44100,
          channels: 1,
          autoPlay: true,
          autoReconnect: true,
          reconnectAttempts: 3,
          reconnectDelay: 1000,
        })
      );
    });
  });

  describe('stopWebSocketStream', () => {
    it('should call native stopWebSocketStream', async () => {
      RNAudioStream.initialize.mockResolvedValueOnce(true);
      await audioStream.initialize();
      await audioStream.stopWebSocketStream();
      expect(RNAudioStream.stopWebSocketStream).toHaveBeenCalled();
    });
  });

  describe('sendWebSocketMessage', () => {
    it('should call native sendWebSocketMessage', async () => {
      RNAudioStream.initialize.mockResolvedValueOnce(true);
      await audioStream.initialize();
      const message = JSON.stringify({ type: 'ping' });
      await audioStream.sendWebSocketMessage(message);
      expect(RNAudioStream.sendWebSocketMessage).toHaveBeenCalledWith(message);
    });
  });
});
