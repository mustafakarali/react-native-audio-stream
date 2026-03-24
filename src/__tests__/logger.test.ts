import { Logger, logger } from '../logger';
import { LogLevel } from '../types';

describe('Logger', () => {
  let loggerInstance: Logger;
  let consoleSpy: {
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
    info: jest.SpyInstance;
    log: jest.SpyInstance;
  };

  beforeEach(() => {
    loggerInstance = Logger.getInstance();
    loggerInstance.setLogLevel(LogLevel.VERBOSE);
    loggerInstance.setTag('TestTag');
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    loggerInstance.setTag('AudioStream');
    loggerInstance.setLogLevel(LogLevel.WARNING);
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const a = Logger.getInstance();
      const b = Logger.getInstance();
      expect(a).toBe(b);
    });

    it('should export a default logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('log levels', () => {
    it('should log error messages', () => {
      loggerInstance.error('test error');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] test error')
      );
    });

    it('should log warning messages', () => {
      loggerInstance.warn('test warning');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] test warning')
      );
    });

    it('should log info messages', () => {
      loggerInstance.info('test info');
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] test info')
      );
    });

    it('should log debug messages', () => {
      loggerInstance.debug('test debug');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] test debug')
      );
    });

    it('should log verbose messages', () => {
      loggerInstance.verbose('test verbose');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[VERBOSE] test verbose')
      );
    });

    it('should include tag in messages', () => {
      loggerInstance.info('tagged message');
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestTag]')
      );
    });

    it('should include timestamp in messages', () => {
      loggerInstance.info('timestamped');
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should include args in messages', () => {
      loggerInstance.info('with args', 'arg1', 'arg2');
      const call = consoleSpy.info.mock.calls[0][0];
      expect(call).toContain('["arg1","arg2"]');
    });
  });

  describe('level filtering', () => {
    it('should not log debug when level is WARNING', () => {
      loggerInstance.setLogLevel(LogLevel.WARNING);
      loggerInstance.debug('should not appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should not log info when level is ERROR', () => {
      loggerInstance.setLogLevel(LogLevel.ERROR);
      loggerInstance.info('should not appear');
      expect(consoleSpy.info).not.toHaveBeenCalled();
    });

    it('should log error when level is ERROR', () => {
      loggerInstance.setLogLevel(LogLevel.ERROR);
      loggerInstance.error('should appear');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should not log verbose when level is INFO', () => {
      loggerInstance.setLogLevel(LogLevel.INFO);
      loggerInstance.verbose('should not appear');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('performance logging', () => {
    it('should handle time/timeEnd with fallback', () => {
      // Force fallback by removing console.time
      const origTime = (console as any).time;
      const origTimeEnd = (console as any).timeEnd;
      (console as any).time = undefined;
      (console as any).timeEnd = undefined;

      loggerInstance.time('testTimer');
      // Wait a bit
      loggerInstance.timeEnd('testTimer');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Timer started')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Timer ended')
      );

      (console as any).time = origTime;
      (console as any).timeEnd = origTimeEnd;
    });

    it('should handle timeEnd without matching time', () => {
      const origTimeEnd = (console as any).timeEnd;
      (console as any).timeEnd = undefined;

      loggerInstance.timeEnd('nonexistent');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Timer not found')
      );

      (console as any).timeEnd = origTimeEnd;
    });

    it('should not time when log level too low', () => {
      loggerInstance.setLogLevel(LogLevel.ERROR);
      loggerInstance.time('skipped');
      loggerInstance.timeEnd('skipped');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('specialized logging', () => {
    it('should log network request', () => {
      loggerInstance.logNetworkRequest('https://example.com', { 'Content-Type': 'audio/mpeg' });
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Network Request')
      );
    });

    it('should log network response', () => {
      loggerInstance.logNetworkResponse('https://example.com', 200, 150);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Network Response')
      );
    });

    it('should log buffer status', () => {
      loggerInstance.logBufferStatus(75, 90);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Buffer Status')
      );
    });

    it('should log playback event', () => {
      loggerInstance.logPlaybackEvent('play', { position: 0 });
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Playback Event: play')
      );
    });

    it('should not log network request when level too low', () => {
      loggerInstance.setLogLevel(LogLevel.ERROR);
      loggerInstance.logNetworkRequest('https://example.com');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should not log buffer status when level too low', () => {
      loggerInstance.setLogLevel(LogLevel.INFO);
      loggerInstance.logBufferStatus(50, 60);
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should not log playback event when level too low', () => {
      loggerInstance.setLogLevel(LogLevel.ERROR);
      loggerInstance.logPlaybackEvent('pause');
      expect(consoleSpy.info).not.toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should log Error objects with stack', () => {
      const error = new Error('test error');
      loggerInstance.logError(error, 'TestContext');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext] test error')
      );
    });

    it('should log string errors', () => {
      loggerInstance.logError('simple string error');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('simple string error')
      );
    });

    it('should log error without context', () => {
      loggerInstance.logError('no context error');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('no context error')
      );
    });

    it('should not log errors when level is NONE', () => {
      loggerInstance.setLogLevel(LogLevel.NONE);
      loggerInstance.logError('should not appear');
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });
});
