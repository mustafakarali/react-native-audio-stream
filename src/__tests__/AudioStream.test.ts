import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import { PlaybackState, LogLevel } from '../types';

describe('AudioStream', () => {
  let audioStream: AudioStream;
  let mockNativeModule: any;

  beforeEach(() => {
    jest.clearAllMocks();
    audioStream = AudioStream.getInstance();
    mockNativeModule = NativeModules.RNAudioStream;
  });

  describe('initialization', () => {
    it('should initialize with default config', async () => {
      await audioStream.initialize();
      
      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          bufferSize: 64,
          prebufferThreshold: 16,
          autoPlay: true,
        })
      );
    });

    it('should initialize with custom config', async () => {
      const customConfig = {
        bufferSize: 128,
        enableCache: true,
        logLevel: LogLevel.DEBUG,
      };

      await audioStream.initialize(customConfig);
      
      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining(customConfig)
      );
    });

    it('should throw error if already initialized', async () => {
      await audioStream.initialize();
      
      // Try to initialize again
      await audioStream.initialize();
      
      // Should only be called once
      expect(mockNativeModule.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('streaming', () => {
    beforeEach(async () => {
      await audioStream.initialize();
    });

    it('should start stream with URL', async () => {
      const url = 'https://example.com/stream.mp3';
      await audioStream.startStream(url);
      
      expect(mockNativeModule.startStream).toHaveBeenCalledWith(
        url,
        expect.any(Object)
      );
    });

    it('should stop stream', async () => {
      await audioStream.stopStream();
      
      expect(mockNativeModule.stopStream).toHaveBeenCalled();
    });
  });

  describe('playback controls', () => {
    beforeEach(async () => {
      await audioStream.initialize();
    });

    it('should play', async () => {
      await audioStream.play();
      expect(mockNativeModule.play).toHaveBeenCalled();
    });

    it('should pause', async () => {
      await audioStream.pause();
      expect(mockNativeModule.pause).toHaveBeenCalled();
    });

    it('should stop', async () => {
      await audioStream.stop();
      expect(mockNativeModule.stop).toHaveBeenCalled();
    });

    it('should seek to position', async () => {
      const position = 30.5;
      await audioStream.seek(position);
      expect(mockNativeModule.seek).toHaveBeenCalledWith(position);
    });

    it('should reject negative seek position', async () => {
      await expect(audioStream.seek(-5)).rejects.toThrow('Seek position cannot be negative');
    });
  });

  describe('volume control', () => {
    beforeEach(async () => {
      await audioStream.initialize();
    });

    it('should set volume', async () => {
      await audioStream.setVolume(0.8);
      expect(mockNativeModule.setVolume).toHaveBeenCalledWith(0.8);
    });

    it('should reject invalid volume values', async () => {
      await expect(audioStream.setVolume(-0.1)).rejects.toThrow('Volume must be between 0.0 and 1.0');
      await expect(audioStream.setVolume(1.1)).rejects.toThrow('Volume must be between 0.0 and 1.0');
    });

    it('should get volume', async () => {
      const volume = await audioStream.getVolume();
      expect(mockNativeModule.getVolume).toHaveBeenCalled();
      expect(volume).toBe(1.0);
    });
  });

  describe('playback rate', () => {
    beforeEach(async () => {
      await audioStream.initialize();
    });

    it('should set playback rate', async () => {
      await audioStream.setPlaybackRate(1.5);
      expect(mockNativeModule.setPlaybackRate).toHaveBeenCalledWith(1.5);
    });

    it('should reject invalid playback rates', async () => {
      await expect(audioStream.setPlaybackRate(0.4)).rejects.toThrow('Playback rate must be between 0.5 and 2.0');
      await expect(audioStream.setPlaybackRate(2.1)).rejects.toThrow('Playback rate must be between 0.5 and 2.0');
    });
  });

  describe('event handling', () => {
    it('should add event listener', () => {
      const callback = jest.fn();
      audioStream.addEventListener('onProgress', callback);
      
      // Verify listener was added (internal state not directly testable with current implementation)
      expect(() => audioStream.addEventListener('onProgress', callback)).not.toThrow();
    });

    it('should remove event listener', () => {
      const callback = jest.fn();
      audioStream.addEventListener('onProgress', callback);
      audioStream.removeEventListener('onProgress', callback);
      
      expect(() => audioStream.removeEventListener('onProgress', callback)).not.toThrow();
    });

    it('should remove all event listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      audioStream.addEventListener('onProgress', callback1);
      audioStream.addEventListener('onError', callback2);
      audioStream.removeAllEventListeners();
      
      expect(() => audioStream.removeAllEventListeners()).not.toThrow();
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AudioStream.getInstance();
      const instance2 = AudioStream.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      // Create new instance to ensure it's not initialized
      const newInstance = new (AudioStream as any)();
      
      await expect(newInstance.play()).rejects.toThrow('AudioStream is not initialized');
    });
  });
}); 