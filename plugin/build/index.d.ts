import { ConfigPlugin } from 'expo/config-plugins';
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
declare const withAudioStream: ConfigPlugin<PluginConfig | void>;
export default withAudioStream;
