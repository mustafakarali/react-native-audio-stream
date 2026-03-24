/**
 * Adapters module — Extensibility layer for react-native-audio-stream.
 * 
 * Provides adapter classes for custom audio sources, decoders,
 * analytics forwarding, and mock streams for testing.
 */

export { CustomSourceAdapter } from './CustomSourceAdapter';
export type { CustomSourceConfig } from './CustomSourceAdapter';

export { CustomDecoderBridge } from './CustomDecoderBridge';
export type { DecoderConfig } from './CustomDecoderBridge';

export { CustomAnalyticsAdapter } from './CustomAnalyticsAdapter';
export type { AnalyticsConfig, AnalyticsEvent } from './CustomAnalyticsAdapter';

export { MockStreamAdapter } from './MockStreamAdapter';
export type { MockStreamConfig, MockPattern } from './MockStreamAdapter';
