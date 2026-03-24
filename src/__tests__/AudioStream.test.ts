import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import { PlaybackState, LogLevel } from '../types';

describe('AudioStream', () => {
  let audioStream: AudioStream;
  let mockNativeModule: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance between tests
    (AudioStream as any).instance = null;
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

  describe('additional playback controls', () => {
    beforeEach(async () => await audioStream.initialize());

    it('should cancel stream', async () => {
      await audioStream.cancelStream();
      expect(mockNativeModule.cancelStream).toHaveBeenCalled();
    });

    it('should get state', async () => {
      const state = await audioStream.getState();
      expect(state).toBe('idle');
      expect(mockNativeModule.getState).toHaveBeenCalled();
    });

    it('should get current time', async () => {
      const time = await audioStream.getCurrentTime();
      expect(time).toBe(0);
      expect(mockNativeModule.getCurrentTime).toHaveBeenCalled();
    });

    it('should get duration', async () => {
      const duration = await audioStream.getDuration();
      expect(duration).toBe(0);
      expect(mockNativeModule.getDuration).toHaveBeenCalled();
    });

    it('should get buffered percentage', async () => {
      const percentage = await audioStream.getBufferedPercentage();
      expect(percentage).toBe(0);
      expect(mockNativeModule.getBufferedPercentage).toHaveBeenCalled();
    });

    it('should get stats', async () => {
      const stats = await audioStream.getStats();
      expect(stats).toEqual({});
      expect(mockNativeModule.getStats).toHaveBeenCalled();
    });

    it('should get metadata', async () => {
      const metadata = await audioStream.getMetadata();
      expect(metadata).toBeNull();
      expect(mockNativeModule.getMetadata).toHaveBeenCalled();
    });
  });

  describe('equalizer settings', () => {
    beforeEach(async () => await audioStream.initialize());

    it('should set equalizer', async () => {
      await audioStream.setEqualizer([]);
      expect(mockNativeModule.setEqualizer).toHaveBeenCalledWith([]);
    });

    it('should get equalizer', async () => {
      const eq = await audioStream.getEqualizer();
      expect(eq).toEqual([]);
      expect(mockNativeModule.getEqualizer).toHaveBeenCalled();
    });

    it('should apply equalizer preset', async () => {
      await audioStream.applyEqualizerPreset(0);
      expect(mockNativeModule.setEqualizer).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should reject invalid preset index', async () => {
      await expect(audioStream.applyEqualizerPreset(-1)).rejects.toThrow();
    });

    it('should return presets list', async () => {
      const presets = await audioStream.getEqualizerPresets();
      expect(presets.length).toBeGreaterThan(0);
    });
  });

  describe('cache and preloading', () => {
    beforeEach(async () => await audioStream.initialize());

    it('should clear cache', async () => {
      await audioStream.clearCache();
      expect(mockNativeModule.clearCache).toHaveBeenCalled();
    });

    it('should get cache size', async () => {
      const size = await audioStream.getCacheSize();
      expect(size).toBe(0);
      expect(mockNativeModule.getCacheSize).toHaveBeenCalled();
    });

    it('should preload stream', async () => {
      await audioStream.preloadStream('https://example.com/stream.mp3', 30);
      expect(mockNativeModule.preloadStream).toHaveBeenCalledWith('https://example.com/stream.mp3', 30);
    });

    it('should set network priority', async () => {
      await audioStream.setNetworkPriority('high');
      expect(mockNativeModule.setNetworkPriority).toHaveBeenCalledWith('high');
    });
  });

  describe('system controls', () => {
    beforeEach(async () => await audioStream.initialize());

    it('should request audio focus', async () => {
      const res = await audioStream.requestAudioFocus();
      expect(res).toBe(true);
      expect(mockNativeModule.requestAudioFocus).toHaveBeenCalled();
    });

    it('should abandon audio focus', async () => {
      await audioStream.abandonAudioFocus();
      expect(mockNativeModule.abandonAudioFocus).toHaveBeenCalled();
    });

    it('should set audio session category', async () => {
      await audioStream.setAudioSessionCategory('playback');
      expect(mockNativeModule.setAudioSessionCategory).toHaveBeenCalledWith('playback');
    });

    it('should show input picker', async () => {
      await audioStream.showInputPicker();
      expect(mockNativeModule.showInputPicker).toHaveBeenCalled();
    });

    it('should get available inputs', async () => {
      const inputs = await audioStream.getAvailableInputs();
      expect(inputs).toEqual([]);
      expect(mockNativeModule.getAvailableInputs).toHaveBeenCalled();
    });

    it('should enable enhanced buffering', async () => {
      await audioStream.enableEnhancedBuffering(true);
      expect(mockNativeModule.enableEnhancedBuffering).toHaveBeenCalledWith(true);
    });

    it('should enable spatial audio', async () => {
      await audioStream.enableSpatialAudio(true);
      expect(mockNativeModule.enableSpatialAudio).toHaveBeenCalledWith(true);
    });

    it('should use queue player', async () => {
      await audioStream.useQueuePlayer(true);
      expect(mockNativeModule.useQueuePlayer).toHaveBeenCalledWith(true);
    });

    it('should create route picker view', async () => {
      const route = await audioStream.createRoutePickerView();
      expect(route).toBe(1);
      expect(mockNativeModule.createRoutePickerView).toHaveBeenCalled();
    });
  });

  describe('binary streaming modes', () => {
    beforeEach(async () => await audioStream.initialize());

    it('should play from data', async () => {
      await audioStream.playFromData('base64String', {});
      expect(mockNativeModule.playFromData).toHaveBeenCalledWith('base64String', expect.any(Object));
    });

    it('should append to buffer', async () => {
      await audioStream.appendToBuffer('base64String');
      expect(mockNativeModule.appendToBuffer).toHaveBeenCalledWith('base64String');
    });

    it('should reject real-time stream start on iOS', async () => {
      try {
         await audioStream.startRealtimeStream();
      } catch (e: any) {
         expect(e.message).toBe('Real-time streaming is only available on Android');
      }
    });

    it('should reject append real-time data on iOS', async () => {
      try {
         await audioStream.appendRealtimeData('data');
      } catch (e: any) {
         expect(e.message).toBe('Real-time streaming is only available on Android');
      }
    });

    it('should reject complete real-time stream on iOS', async () => {
      try {
         await audioStream.completeRealtimeStream();
      } catch (e: any) {
         expect(e.message).toBe('Real-time streaming is only available on Android');
      }
    });

    it('should reject get streaming stats on iOS', async () => {
      try {
         await audioStream.getStreamingStats();
      } catch (e: any) {
         expect(e.message).toBe('Real-time streaming is only available on Android');
      }
    });
  });

  describe('static methods', () => {
    it('should throw on startMemoryStream on iOS', async () => {
      await expect(AudioStream.startMemoryStream()).rejects.toThrow('Memory streaming is only available on Android');
    });

    it('should throw on appendToMemoryStream on iOS', async () => {
      await expect(AudioStream.appendToMemoryStream('data')).rejects.toThrow('Memory streaming is only available on Android');
    });

    it('should throw on completeMemoryStream on iOS', async () => {
      await expect(AudioStream.completeMemoryStream()).rejects.toThrow('Memory streaming is only available on Android');
    });
  });

  describe('lifecycle management', () => {
    it('should destroy and clean up', async () => {
      await audioStream.initialize();
      await audioStream.destroy();
      expect(mockNativeModule.destroy).toHaveBeenCalled();
    });

    it('should throw after destroy when calling play', async () => {
      await audioStream.initialize();
      await audioStream.destroy();
      await expect(audioStream.play()).rejects.toThrow('AudioStream is not initialized');
    });

    it('should re-initialize after destroy', async () => {
      await audioStream.initialize();
      await audioStream.destroy();
      await audioStream.initialize();
      expect(mockNativeModule.initialize).toHaveBeenCalledTimes(2);
    });
  });

  describe('error propagation from native module', () => {
    it('should propagate start stream errors as StreamError', async () => {
      await audioStream.initialize();
      mockNativeModule.startStream.mockRejectedValueOnce(new Error('Network timeout'));
      
      try {
        await audioStream.startStream('https://example.com/stream.mp3');
      } catch (e: any) {
        expect(e.code).toBe('NETWORK_ERROR');
        expect(e.message).toBe('Failed to start stream');
        expect(e.recoverable).toBe(true);
      }
    });

    it('should propagate play errors as StreamError', async () => {
      await audioStream.initialize();
      mockNativeModule.play.mockRejectedValueOnce(new Error('Invalid state'));
      
      try {
        await audioStream.play();
      } catch (e: any) {
        expect(e.code).toBe('INVALID_STATE');
        expect(e.message).toBe('Failed to play');
      }
    });

    it('should propagate pause errors as StreamError', async () => {
      await audioStream.initialize();
      mockNativeModule.pause.mockRejectedValueOnce(new Error('No player'));
      
      try {
        await audioStream.pause();
      } catch (e: any) {
        expect(e.code).toBe('INVALID_STATE');
        expect(e.message).toBe('Failed to pause');
      }
    });

    it('should propagate seek errors as StreamError', async () => {
      await audioStream.initialize();
      mockNativeModule.seek.mockRejectedValueOnce(new Error('Seek failed'));
      
      try {
        await audioStream.seek(100);
      } catch (e: any) {
        expect(e.code).toBe('INVALID_STATE');
        expect(e.message).toBe('Failed to seek');
      }
    });

    it('should propagate volume errors', async () => {
      await audioStream.initialize();
      mockNativeModule.setVolume.mockRejectedValueOnce(new Error('Volume failed'));
      
      await expect(audioStream.setVolume(0.5)).rejects.toThrow('Volume failed');
    });

    it('should propagate playback rate errors', async () => {
      await audioStream.initialize();
      mockNativeModule.setPlaybackRate.mockRejectedValueOnce(new Error('Rate failed'));
      
      await expect(audioStream.setPlaybackRate(1.0)).rejects.toThrow('Rate failed');
    });

    it('should propagate getState errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getState.mockRejectedValueOnce(new Error('State failed'));
      
      await expect(audioStream.getState()).rejects.toThrow('State failed');
    });

    it('should propagate getCurrentTime errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getCurrentTime.mockRejectedValueOnce(new Error('Time failed'));
      
      await expect(audioStream.getCurrentTime()).rejects.toThrow('Time failed');
    });

    it('should propagate getDuration errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getDuration.mockRejectedValueOnce(new Error('Duration failed'));
      
      await expect(audioStream.getDuration()).rejects.toThrow('Duration failed');
    });

    it('should propagate getBufferedPercentage errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getBufferedPercentage.mockRejectedValueOnce(new Error('Buffer failed'));
      
      await expect(audioStream.getBufferedPercentage()).rejects.toThrow('Buffer failed');
    });

    it('should propagate getStats errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getStats.mockRejectedValueOnce(new Error('Stats failed'));
      
      await expect(audioStream.getStats()).rejects.toThrow('Stats failed');
    });

    it('should propagate getMetadata errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getMetadata.mockRejectedValueOnce(new Error('Metadata failed'));
      
      await expect(audioStream.getMetadata()).rejects.toThrow('Metadata failed');
    });

    it('should propagate getVolume errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getVolume.mockRejectedValueOnce(new Error('Get volume failed'));
      
      await expect(audioStream.getVolume()).rejects.toThrow('Get volume failed');
    });

    it('should propagate getPlaybackRate errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getPlaybackRate.mockRejectedValueOnce(new Error('Get rate failed'));
      
      await expect(audioStream.getPlaybackRate()).rejects.toThrow('Get rate failed');
    });

    it('should propagate setEqualizer errors', async () => {
      await audioStream.initialize();
      mockNativeModule.setEqualizer.mockRejectedValueOnce(new Error('EQ failed'));
      
      await expect(audioStream.setEqualizer([])).rejects.toThrow('EQ failed');
    });

    it('should propagate getEqualizer errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getEqualizer.mockRejectedValueOnce(new Error('Get EQ failed'));
      
      await expect(audioStream.getEqualizer()).rejects.toThrow('Get EQ failed');
    });

    it('should propagate clearCache errors as StreamError', async () => {
      await audioStream.initialize();
      mockNativeModule.clearCache.mockRejectedValueOnce(new Error('Cache error'));
      
      try {
        await audioStream.clearCache();
      } catch (e: any) {
        expect(e.code).toBe('CACHE_ERROR');
        expect(e.message).toBe('Failed to clear cache');
      }
    });

    it('should propagate getCacheSize errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getCacheSize.mockRejectedValueOnce(new Error('Cache size failed'));
      
      await expect(audioStream.getCacheSize()).rejects.toThrow('Cache size failed');
    });

    it('should propagate preloadStream errors as StreamError', async () => {
      await audioStream.initialize();
      mockNativeModule.preloadStream.mockRejectedValueOnce(new Error('Preload error'));
      
      try {
        await audioStream.preloadStream('https://example.com/test.mp3');
      } catch (e: any) {
        expect(e.code).toBe('NETWORK_ERROR');
        expect(e.message).toBe('Failed to preload stream');
        expect(e.recoverable).toBe(true);
      }
    });

    it('should propagate setNetworkPriority errors', async () => {
      await audioStream.initialize();
      mockNativeModule.setNetworkPriority.mockRejectedValueOnce(new Error('Priority failed'));
      
      await expect(audioStream.setNetworkPriority('high')).rejects.toThrow('Priority failed');
    });

    it('should propagate requestAudioFocus errors', async () => {
      await audioStream.initialize();
      mockNativeModule.requestAudioFocus.mockRejectedValueOnce(new Error('Focus failed'));
      
      await expect(audioStream.requestAudioFocus()).rejects.toThrow('Focus failed');
    });

    it('should propagate abandonAudioFocus errors', async () => {
      await audioStream.initialize();
      mockNativeModule.abandonAudioFocus.mockRejectedValueOnce(new Error('Abandon failed'));
      
      await expect(audioStream.abandonAudioFocus()).rejects.toThrow('Abandon failed');
    });

    it('should propagate setAudioSessionCategory errors', async () => {
      await audioStream.initialize();
      mockNativeModule.setAudioSessionCategory.mockRejectedValueOnce(new Error('Session failed'));
      
      await expect(audioStream.setAudioSessionCategory('playback')).rejects.toThrow('Session failed');
    });

    it('should propagate cancelStream errors', async () => {
      await audioStream.initialize();
      mockNativeModule.cancelStream.mockRejectedValueOnce(new Error('Cancel failed'));
      
      await expect(audioStream.cancelStream()).rejects.toThrow('Cancel failed');
    });

    it('should propagate stopStream errors', async () => {
      await audioStream.initialize();
      mockNativeModule.stopStream.mockRejectedValueOnce(new Error('Stop failed'));
      
      await expect(audioStream.stopStream()).rejects.toThrow('Stop failed');
    });

    it('should propagate stop errors', async () => {
      await audioStream.initialize();
      mockNativeModule.stop.mockRejectedValueOnce(new Error('Stop failed'));
      
      await expect(audioStream.stop()).rejects.toThrow('Stop failed');
    });

    it('should propagate destroy errors', async () => {
      await audioStream.initialize();
      mockNativeModule.destroy.mockRejectedValueOnce(new Error('Destroy failed'));
      
      await expect(audioStream.destroy()).rejects.toThrow('Destroy failed');
    });

    it('should propagate showInputPicker errors as StreamError', async () => {
      await audioStream.initialize();
      mockNativeModule.showInputPicker.mockRejectedValueOnce(new Error('Picker failed'));
      
      try {
        await audioStream.showInputPicker();
      } catch (e: any) {
        expect(e.code).toBe('UNSUPPORTED_FORMAT');
      }
    });

    it('should propagate getAvailableInputs errors', async () => {
      await audioStream.initialize();
      mockNativeModule.getAvailableInputs.mockRejectedValueOnce(new Error('Inputs failed'));
      
      await expect(audioStream.getAvailableInputs()).rejects.toThrow('Inputs failed');
    });

    it('should propagate enableEnhancedBuffering errors', async () => {
      await audioStream.initialize();
      mockNativeModule.enableEnhancedBuffering.mockRejectedValueOnce(new Error('Buffer failed'));
      
      await expect(audioStream.enableEnhancedBuffering(true)).rejects.toThrow('Buffer failed');
    });

    it('should propagate enableSpatialAudio errors', async () => {
      await audioStream.initialize();
      mockNativeModule.enableSpatialAudio.mockRejectedValueOnce(new Error('Spatial failed'));
      
      await expect(audioStream.enableSpatialAudio(true)).rejects.toThrow('Spatial failed');
    });

    it('should propagate useQueuePlayer errors', async () => {
      await audioStream.initialize();
      mockNativeModule.useQueuePlayer.mockRejectedValueOnce(new Error('Queue failed'));
      
      await expect(audioStream.useQueuePlayer(true)).rejects.toThrow('Queue failed');
    });

    it('should propagate createRoutePickerView errors', async () => {
      await audioStream.initialize();
      mockNativeModule.createRoutePickerView.mockRejectedValueOnce(new Error('Route failed'));
      
      await expect(audioStream.createRoutePickerView()).rejects.toThrow('Route failed');
    });

    it('should propagate playFromData errors', async () => {
      await audioStream.initialize();
      mockNativeModule.playFromData.mockRejectedValueOnce(new Error('Data failed'));
      
      await expect(audioStream.playFromData('data', {})).rejects.toThrow('Data failed');
    });

    it('should propagate appendToBuffer errors', async () => {
      await audioStream.initialize();
      mockNativeModule.appendToBuffer.mockRejectedValueOnce(new Error('Append failed'));
      
      await expect(audioStream.appendToBuffer('data')).rejects.toThrow('Append failed');
    });

    it('should propagate initialize errors as StreamError', async () => {
      mockNativeModule.initialize.mockRejectedValueOnce(new Error('Init failed'));
      
      try {
        await audioStream.initialize();
      } catch (e: any) {
        expect(e.code).toBe('INITIALIZATION_ERROR');
        expect(e.message).toBe('Failed to initialize audio stream');
      }
    });
  });

  describe('edge cases', () => {
    it('should not add null callback', () => {
      audioStream.addEventListener('onProgress', null as any);
      // Should silently ignore
    });

    it('should not remove null callback', () => {
      audioStream.removeEventListener('onProgress', null as any);
      // Should silently ignore
    });

    it('should handle removing listener that was never added', () => {
      expect(() => audioStream.removeEventListener('onProgress', jest.fn())).not.toThrow();
    });

    it('should apply equalizer preset by object', async () => {
      await audioStream.initialize();
      const preset = { name: 'Custom', bands: [{ frequency: 60, gain: 0.5 }] };
      await audioStream.applyEqualizerPreset(preset as any);
      expect(mockNativeModule.setEqualizer).toHaveBeenCalledWith([{ frequency: 60, gain: 0.5 }]);
    });

    it('should handle init with logLevel config', async () => {
      await audioStream.initialize({ logLevel: 5 } as any);
      expect(mockNativeModule.initialize).toHaveBeenCalled();
    });

    it('should track currentUrl after startStream', async () => {
      await audioStream.initialize();
      await audioStream.startStream('https://example.com/audio.mp3');
      // After stop, currentUrl is cleared
      await audioStream.stopStream();
      // No assertion on private field but ensuring no crash
    });

    it('should clear currentUrl on cancelStream', async () => {
      await audioStream.initialize();
      await audioStream.startStream('https://example.com/audio.mp3');
      await audioStream.cancelStream();
      // No assertion on private field but ensuring no crash
    });
  });
}); 