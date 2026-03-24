import {
  PlaybackState,
  LogLevel,
  ErrorCodes,
  EQUALIZER_PRESETS,
  DEFAULT_CONFIG,
} from '../types';

describe('Types and Constants', () => {
  describe('PlaybackState enum', () => {
    it('should have all expected states', () => {
      expect(PlaybackState.IDLE).toBe('idle');
      expect(PlaybackState.BUFFERING).toBe('buffering');
      expect(PlaybackState.PLAYING).toBe('playing');
      expect(PlaybackState.PAUSED).toBe('paused');
      expect(PlaybackState.STOPPED).toBe('stopped');
      expect(PlaybackState.ERROR).toBe('error');
    });
  });

  describe('LogLevel enum', () => {
    it('should have ordered numeric values', () => {
      expect(LogLevel.NONE).toBeLessThan(LogLevel.ERROR);
      expect(LogLevel.ERROR).toBeLessThan(LogLevel.WARNING);
      expect(LogLevel.WARNING).toBeLessThan(LogLevel.INFO);
      expect(LogLevel.INFO).toBeLessThan(LogLevel.DEBUG);
      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.VERBOSE);
    });
  });

  describe('ErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCodes.NETWORK_ERROR).toBeDefined();
      expect(ErrorCodes.INVALID_STATE).toBeDefined();
      expect(ErrorCodes.UNSUPPORTED_FORMAT).toBeDefined();
      expect(ErrorCodes.CACHE_ERROR).toBeDefined();
    });
  });

  describe('EQUALIZER_PRESETS', () => {
    it('should contain at least 1 preset', () => {
      expect(EQUALIZER_PRESETS.length).toBeGreaterThan(0);
    });

    it('should have name and bands on each preset', () => {
      EQUALIZER_PRESETS.forEach((preset) => {
        expect(preset.name).toBeDefined();
        expect(typeof preset.name).toBe('string');
        expect(Array.isArray(preset.bands)).toBe(true);
        expect(preset.bands.length).toBeGreaterThan(0);
      });
    });

    it('should have valid band structure', () => {
      const firstPreset = EQUALIZER_PRESETS[0];
      if (firstPreset) {
        firstPreset.bands.forEach((band) => {
          expect(typeof band.frequency).toBe('number');
          expect(typeof band.gain).toBe('number');
        });
      }
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CONFIG.bufferSize).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.autoPlay).toBe(true);
      expect(typeof DEFAULT_CONFIG.prebufferThreshold).toBe('number');
    });
  });
});
