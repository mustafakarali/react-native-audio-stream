import { renderHook, act } from '@testing-library/react-hooks';
import { useAudioStream } from '../../src/hooks/useAudioStream';
import { useStreamProgress } from '../../src/hooks/useStreamProgress';
import { AudioStream } from '../../src/AudioStream';
import { NativeModules } from 'react-native';

describe('Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance between tests
    (AudioStream as any).instance = null;
    AudioStream.getInstance().removeAllEventListeners();
  });

  describe('useAudioStream', () => {
    it('initializes automatically by default', async () => {
      const { result } = renderHook(() => useAudioStream());
      
      expect(result.current.isInitialized).toBe(false);
      
      // Flush microtasks
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) });
      
      expect(result.current.isInitialized).toBe(true);
      expect(NativeModules.RNAudioStream.initialize).toHaveBeenCalled();
    });

    it('does not initialize automatically if autoInit is false', () => {
      const { result } = renderHook(() => useAudioStream({ autoInit: false }));
      
      expect(result.current.isInitialized).toBe(false);
      expect(NativeModules.RNAudioStream.initialize).not.toHaveBeenCalled();
    });

    it('exposes playback state correctly', async () => {
      const { result } = renderHook(() => useAudioStream());
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) }); // wait for init
      
      expect(result.current.state).toBe('idle');
      expect(result.current.isPlaying).toBe(false);
      
      // Simulate native event
      act(() => {
        // Find the registered callback
        const instance = AudioStream.getInstance() as any;
        const listeners = instance.eventListeners.get('onStateChange');
        listeners.forEach((l: any) => l('playing'));
      });
      
      expect(result.current.state).toBe('playing');
      expect(result.current.isPlaying).toBe(true);
    });

    it('handles startStream', async () => {
      const { result } = renderHook(() => useAudioStream());
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) }); // wait for init
      
      await act(async () => {
        await result.current.startStream('https://example.com/test.mp3');
      });
      
      expect(NativeModules.RNAudioStream.startStream).toHaveBeenCalledWith(
        'https://example.com/test.mp3',
        expect.any(Object)
      );
    });

    it('handles play, pause, stop, seek, volume, rate', async () => {
      const { result } = renderHook(() => useAudioStream());
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) }); // wait for init
      
      await act(async () => {
        await result.current.play();
        await result.current.pause();
        await result.current.stopStream(); // Hook uses stopStream
        await result.current.seek(10);
        await result.current.setVolume(0.5);
        await result.current.setPlaybackRate(1.2);
      });
      
      expect(NativeModules.RNAudioStream.play).toHaveBeenCalled();
      expect(NativeModules.RNAudioStream.pause).toHaveBeenCalled();
      expect(NativeModules.RNAudioStream.stopStream).toHaveBeenCalled();
      expect(NativeModules.RNAudioStream.seek).toHaveBeenCalledWith(10);
      expect(NativeModules.RNAudioStream.setVolume).toHaveBeenCalledWith(0.5);
      expect(NativeModules.RNAudioStream.setPlaybackRate).toHaveBeenCalledWith(1.2);
    });
  });

  describe('useStreamProgress', () => {
    it('updates progress when native event fires', () => {
      const { result } = renderHook(() => useStreamProgress());
      
      expect(result.current.currentTime).toBe(0);
      expect(result.current.percentage).toBe(0);
      
      act(() => {
        const instance = AudioStream.getInstance() as any;
        const listeners = instance.eventListeners.get('onProgress');
        listeners.forEach((l: any) => l({
          currentTime: 10,
          duration: 100,
          percentage: 10
        }));
      });
      
      expect(result.current.currentTime).toBe(10);
      expect(result.current.duration).toBe(100);
      expect(result.current.percentage).toBe(10);
    });

    it('updates stats when native event fires', () => {
      const { result } = renderHook(() => useStreamProgress());
      
      expect(result.current.stats).toBeNull();
      
      const mockStats = { bitRate: 128, bufferedDuration: 10 };
      
      act(() => {
        const instance = AudioStream.getInstance() as any;
        const listeners = instance.eventListeners.get('onStats');
        listeners.forEach((l: any) => l(mockStats));
      });
      
      expect(result.current.stats).toEqual(mockStats);
    });
  });
});
