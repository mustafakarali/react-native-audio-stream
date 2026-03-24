"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("expo/config-plugins");
const withAudioStreamIOS = (config, props) => {
    const enableBackground = props?.enableBackgroundAudio ?? true;
    return (0, config_plugins_1.withInfoPlist)(config, (infoPlistConfig) => {
        if (enableBackground) {
            const existingModes = infoPlistConfig.modResults.UIBackgroundModes || [];
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
const withAudioStreamAndroid = (config, props) => {
    const enableForegroundService = props?.enableForegroundService ?? true;
    return (0, config_plugins_1.withAndroidManifest)(config, (manifestConfig) => {
        const mainApplication = config_plugins_1.AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);
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
                const exists = permissions.some((p) => p.$?.['android:name'] === perm);
                if (!exists) {
                    permissions.push({
                        $: { 'android:name': perm },
                    });
                }
            }
            // Add AudioStreamService
            if (!mainApplication.service) {
                mainApplication.service = [];
            }
            const serviceExists = mainApplication.service.some((s) => s.$?.['android:name'] === '.AudioStreamService');
            if (!serviceExists) {
                mainApplication.service.push({
                    $: {
                        'android:name': '.AudioStreamService',
                        'android:foregroundServiceType': 'mediaPlayback',
                        'android:exported': 'false',
                    },
                });
            }
        }
        return manifestConfig;
    });
};
const withAudioStream = (config, props = {}) => {
    const pluginConfig = props ?? {};
    config = withAudioStreamIOS(config, pluginConfig);
    config = withAudioStreamAndroid(config, pluginConfig);
    return config;
};
exports.default = withAudioStream;
