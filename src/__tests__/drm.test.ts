import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import type { DRMConfig } from '../types';

const RNAudioStream = NativeModules.RNAudioStream;

describe('DRM Support', () => {
  let audioStream: AudioStream;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    RNAudioStream.initialize.mockResolvedValueOnce(true);
    await audioStream.initialize();
  });

  describe('Widevine DRM', () => {
    it('should pass Widevine DRM config through startStream', async () => {
      const drmConfig: DRMConfig = {
        type: 'widevine',
        licenseUrl: 'https://license.example.com/widevine',
        headers: { 'Authorization': 'Bearer token123' },
      };

      await audioStream.startStream('https://example.com/stream.mpd', { drm: drmConfig });

      expect(RNAudioStream.startStream).toHaveBeenCalledWith(
        'https://example.com/stream.mpd',
        expect.objectContaining({
          drm: expect.objectContaining({
            type: 'widevine',
            licenseUrl: 'https://license.example.com/widevine',
          }),
        })
      );
    });

    it('should support offline license persistence', async () => {
      const drmConfig: DRMConfig = {
        type: 'widevine',
        licenseUrl: 'https://license.example.com/widevine',
        persistLicense: true,
      };

      await audioStream.startStream('https://example.com/protected.mpd', { drm: drmConfig });

      expect(RNAudioStream.startStream).toHaveBeenCalledWith(
        'https://example.com/protected.mpd',
        expect.objectContaining({
          drm: expect.objectContaining({
            type: 'widevine',
            persistLicense: true,
          }),
        })
      );
    });
  });

  describe('FairPlay DRM', () => {
    it('should pass FairPlay DRM config with certificate URL', async () => {
      const drmConfig: DRMConfig = {
        type: 'fairplay',
        licenseUrl: 'https://license.example.com/fairplay',
        certificateUrl: 'https://cert.example.com/fps.cer',
        contentId: 'content-123',
      };

      await audioStream.startStream('https://example.com/stream.m3u8', { drm: drmConfig });

      expect(RNAudioStream.startStream).toHaveBeenCalledWith(
        'https://example.com/stream.m3u8',
        expect.objectContaining({
          drm: expect.objectContaining({
            type: 'fairplay',
            certificateUrl: 'https://cert.example.com/fps.cer',
            contentId: 'content-123',
          }),
        })
      );
    });
  });

  describe('AES-128 DRM', () => {
    it('should pass AES-128 config (handled natively by HLS)', async () => {
      const drmConfig: DRMConfig = {
        type: 'aes-128',
        licenseUrl: 'https://keys.example.com/key',
      };

      await audioStream.startStream('https://example.com/encrypted.m3u8', { drm: drmConfig });

      expect(RNAudioStream.startStream).toHaveBeenCalledWith(
        'https://example.com/encrypted.m3u8',
        expect.objectContaining({
          drm: expect.objectContaining({
            type: 'aes-128',
          }),
        })
      );
    });
  });

  describe('ClearKey DRM', () => {
    it('should pass ClearKey DRM config', async () => {
      const drmConfig: DRMConfig = {
        type: 'clearkey',
        licenseUrl: 'https://license.example.com/clearkey',
      };

      await audioStream.startStream('https://example.com/test.mpd', { drm: drmConfig });

      expect(RNAudioStream.startStream).toHaveBeenCalledWith(
        'https://example.com/test.mpd',
        expect.objectContaining({
          drm: expect.objectContaining({
            type: 'clearkey',
            licenseUrl: 'https://license.example.com/clearkey',
          }),
        })
      );
    });
  });

  describe('DRM Config Validation', () => {
    it('should work with no DRM config (non-protected stream)', async () => {
      await audioStream.startStream('https://example.com/free.mp3');

      expect(RNAudioStream.startStream).toHaveBeenCalledWith(
        'https://example.com/free.mp3',
        expect.not.objectContaining({ drm: expect.anything() })
      );
    });

    it('should include custom DRM headers', async () => {
      const drmConfig: DRMConfig = {
        type: 'widevine',
        licenseUrl: 'https://license.example.com/widevine',
        headers: {
          'X-Custom-Header': 'custom-value',
          'Authorization': 'Bearer token',
        },
      };

      await audioStream.startStream('https://example.com/stream.mpd', { drm: drmConfig });

      const calledConfig = RNAudioStream.startStream.mock.calls[0][1];
      expect(calledConfig.drm.headers).toEqual({
        'X-Custom-Header': 'custom-value',
        'Authorization': 'Bearer token',
      });
    });
  });
});
