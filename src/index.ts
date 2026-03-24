// Core
export { AudioStream } from './AudioStream';

// Types
export * from './types';

// Hooks
export { useAudioStream } from './hooks/useAudioStream';
export { useStreamProgress } from './hooks/useStreamProgress';
export { usePlaylist } from './hooks/usePlaylist';
export type { UseAudioStreamOptions, UseAudioStreamReturn } from './hooks/useAudioStream';
export type { UseStreamProgressOptions, StreamProgress } from './hooks/useStreamProgress';
export type { UsePlaylistOptions, UsePlaylistReturn } from './hooks/usePlaylist';

// Utilities
export { logger } from './logger';
export { PluginManager } from './plugins/PluginManager';
export type { AudioStreamPlugin } from './plugins/PluginManager';
export {
  CustomSourceAdapter,
  CustomDecoderBridge,
  CustomAnalyticsAdapter,
  MockStreamAdapter,
} from './adapters';
export type {
  CustomSourceConfig,
  DecoderConfig,
  AnalyticsConfig,
  AnalyticsEvent,
  MockStreamConfig,
  MockPattern,
} from './adapters';

// Default export — singleton instance for convenience
import { AudioStream } from './AudioStream';
export default AudioStream.getInstance();