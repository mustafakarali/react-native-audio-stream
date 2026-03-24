import {
  ConfigPlugin,
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
} from 'expo/config-plugins';

/**
 * Expo Config Plugin for react-native-audio-stream
 *
 * Automatically configures:
 * - iOS: UIBackgroundModes (audio), audio session category
 * - Android: FOREGROUND_SERVICE permission, FOREGROUND_SERVICE_MEDIA_PLAYBACK,
 *            POST_NOTIFICATIONS, AudioStreamService declaration
 */

type PluginConfig = {
  /**
   * Enable background audio playback.
   * @default true
   */
  enableBackgroundAudio?: boolean;

  /**
   * Android: Enable foreground service for persistent playback.
   * @default true
   */
  enableForegroundService?: boolean;
};

const withAudioStreamIOS: ConfigPlugin<PluginConfig> = (config, props) => {
  const enableBackground = props?.enableBackgroundAudio ?? true;

  return withInfoPlist(config, (infoPlistConfig) => {
    if (enableBackground) {
      const existingModes =
        (infoPlistConfig.modResults.UIBackgroundModes as string[]) || [];

      if (!existingModes.includes('audio')) {
        infoPlistConfig.modResults.UIBackgroundModes = [
          ...existingModes,
          'audio',
        ];
      }
    }

    return infoPlistConfig;
  });
};

const withAudioStreamAndroid: ConfigPlugin<PluginConfig> = (config, props) => {
  const enableForegroundService = props?.enableForegroundService ?? true;

  return withAndroidManifest(config, (manifestConfig) => {
    const mainApplication =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);

    if (enableForegroundService) {
      // Add permissions
      const manifest = manifestConfig.modResults.manifest;
      if (!manifest['uses-permission']) {
        manifest['uses-permission'] = [];
      }

      const permissions = manifest['uses-permission'];
      const requiredPermissions = [
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.INTERNET',
      ];

      for (const perm of requiredPermissions) {
        const exists = permissions.some(
          (p: any) => p.$?.['android:name'] === perm
        );
        if (!exists) {
          permissions.push({
            $: { 'android:name': perm },
          } as any);
        }
      }

      // Add AudioStreamService
      if (!mainApplication.service) {
        mainApplication.service = [];
      }

      const serviceExists = mainApplication.service.some(
        (s: any) => s.$?.['android:name'] === '.AudioStreamService'
      );

      if (!serviceExists) {
        mainApplication.service.push({
          $: {
            'android:name': '.AudioStreamService',
            'android:foregroundServiceType': 'mediaPlayback',
            'android:exported': 'false',
          },
        } as any);
      }
    }

    return manifestConfig;
  });
};

const withAudioStream: ConfigPlugin<PluginConfig | void> = (
  config,
  props = {}
) => {
  const pluginConfig: PluginConfig = props ?? {};

  config = withAudioStreamIOS(config, pluginConfig);
  config = withAudioStreamAndroid(config, pluginConfig);

  return config;
};

export default withAudioStream;
