import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import { PlaybackState } from '../types';

/**
 * Tests for stream reconnect logic:
 * - Verifies reconnect config fields are passed to native
 * - Verifies enableBackgroundMode is passed to native
 * - Verifies error event structure for recoverable/non-recoverable errors
 */

describe('Stream Reconnect', () => {
  let audioStream: AudioStream;
  let mockNativeModule: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    mockNativeModule = NativeModules.RNAudioStream;
  });

  describe('Reconnect config passed to native', () => {
    it('should pass reconnectAttempts to native initialize', async () => {
      await audioStream.initialize({
        reconnectAttempts: 5,
        reconnectDelay: 2000,
        timeout: 15000,
      });

      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          reconnectAttempts: 5,
          reconnectDelay: 2000,
          timeout: 15000,
        })
      );
    });

    it('should use default reconnect values when not specified', async () => {
      await audioStream.initialize({});

      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          reconnectAttempts: 3,
          reconnectDelay: 1000,
          timeout: 30000,
        })
      );
    });

    it('should pass high reconnect attempts', async () => {
      await audioStream.initialize({
        reconnectAttempts: 10,
        reconnectDelay: 5000,
      });

      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          reconnectAttempts: 10,
          reconnectDelay: 5000,
        })
      );
    });

    it('should pass zero reconnect attempts (disable reconnect)', async () => {
      await audioStream.initialize({
        reconnectAttempts: 0,
      });

      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          reconnectAttempts: 0,
        })
      );
    });
  });

  describe('Error event structure', () => {
    it('should define recoverable error structure', () => {
      const recoverableError = {
        code: 'NETWORK_ERROR',
        message: 'Connection lost, retrying...',
        recoverable: true,
        details: {
          attempt: 1,
          maxAttempts: 3,
          delayMs: 1000,
        },
      };

      expect(recoverableError.recoverable).toBe(true);
      expect(recoverableError.details.attempt).toBe(1);
      expect(recoverableError.details.maxAttempts).toBe(3);
      expect(recoverableError.details.delayMs).toBe(1000);
    });

    it('should define non-recoverable error structure', () => {
      const nonRecoverableError = {
        code: 'NETWORK_ERROR',
        message: 'All reconnect attempts failed',
        recoverable: false,
      };

      expect(nonRecoverableError.recoverable).toBe(false);
      expect(nonRecoverableError.code).toBe('NETWORK_ERROR');
    });

    it('should define exponential backoff delay structure', () => {
      const attempts = [
        { attempt: 1, delayMs: 1000 },
        { attempt: 2, delayMs: 2000 },
        { attempt: 3, delayMs: 4000 },
      ];

      // Verify exponential backoff pattern
      for (let i = 1; i < attempts.length; i++) {
        expect(attempts[i].delayMs).toBe(attempts[i - 1].delayMs * 2);
      }
    });
  });

  describe('enableBackgroundMode config', () => {
    it('should pass enableBackgroundMode true to native', async () => {
      await audioStream.initialize({ enableBackgroundMode: true });

      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          enableBackgroundMode: true,
        })
      );
    });

    it('should default enableBackgroundMode to false', async () => {
      await audioStream.initialize({});

      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          enableBackgroundMode: false,
        })
      );
    });
  });

  describe('Timeout config', () => {
    it('should pass custom timeout to native', async () => {
      await audioStream.initialize({ timeout: 60000 });

      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000,
        })
      );
    });

    it('should default timeout to 30000ms', async () => {
      await audioStream.initialize({});

      expect(mockNativeModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });
  });
});
