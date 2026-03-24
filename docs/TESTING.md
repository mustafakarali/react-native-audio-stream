# Testing Guide

## Unit Tests

The TypeScript layer has **142 automated tests** across 4 test suites with real coverage:

```bash
yarn test            # Run all tests
yarn test:coverage   # Run with coverage report
```

### Test Suites

| Suite | File | Tests | Coverage |
|-------|------|-------|----------|
| Core API | `src/__tests__/AudioStream.test.ts` | 100+ | All wrapper methods, error paths, lifecycle, edge cases |
| React Hooks | `src/__tests__/hooks.test.ts` | 7 | `useAudioStream`, `useStreamProgress` |
| Logger | `src/__tests__/logger.test.ts` | 25+ | All log levels, filtering, performance timing, error logging |
| Types | `src/__tests__/types.test.ts` | 10+ | Enums, constants, presets, default config |

### Coverage Thresholds

Enforced via `jest.config.js`:
- **Statements**: ≥80%
- **Branches**: ≥60% (lower due to platform-specific code paths and WebSocket streaming untestable in Jest without native modules)
- **Functions**: ≥80%
- **Lines**: ≥80%

## Platform Requirements

- **iOS**: 16.0+ (real devices recommended — simulator has limited audio support)
- **Android**: API 24+ (minSdkVersion 24, targetSdkVersion 36)
- **React Native**: ≥0.76.0 (New Architecture support)

## Manual Testing Checklist

### Core Playback
1. Start stream from MP3 URL → verify playback begins within 2s
2. Pause/resume → verify correct state transitions
3. Seek to position → verify position updates
4. Stop → verify cleanup and no lingering audio

### Network Resilience
1. Start stream → disconnect WiFi → reconnect → verify recovery
2. Start stream on low bandwidth → verify buffering events fire
3. Stream from invalid URL → verify proper error event

### Background Audio
1. Start stream → press home → verify audio continues
2. Verify lock screen controls (iOS: play/pause/seek via Control Center)
3. Verify `MPNowPlayingInfoCenter` shows correct metadata (iOS)

### Platform-Specific

#### iOS
- Background audio with `UIBackgroundModes = audio`
- Audio session interruption handling (phone calls)
- Lock screen controls via `MPRemoteCommandCenter`
- Equalizer via `AVAudioUnitEQ` (5-band)
- Real-time PCM streaming via `AVAudioEngine` + `AVAudioPlayerNode`
- WebSocket streaming via `NSURLSessionWebSocketTask`

#### Android
- Foreground service for persistent playback
- Audio focus management (duck, pause on loss)
- Real-time PCM streaming via `RealtimeStreamingDataSource` + `PipedInputStream`
- WebSocket streaming via OkHttp `WebSocket`
- Hardware equalizer via `android.media.audiofx.Equalizer`

## Performance Targets

| Metric | Target |
|--------|--------|
| Stream start latency | < 2 seconds |
| Buffer recovery time | < 3 seconds |
| Memory usage | < 50MB for normal streams |
| CPU usage | < 10% during playback |

## Known Platform Limitations

### iOS-Only Features (reject with `UNSUPPORTED` on Android)
- `showInputPicker` — requires UIKit view management
- `createRoutePickerView` — requires UIKit view management
- `enableSpatialAudio` — no Android equivalent

### Android-Only Features (reject with error on iOS)
- `startMemoryStream` / `appendToMemoryStream` — in-memory streaming

### Both Platforms
- Real-time PCM streaming (`startRealtimeStream` / `appendRealtimeData`)
- WebSocket streaming (`startWebSocketStream` / `stopWebSocketStream`)
- Streaming stats (`getStreamingStats`)
- Gapless playback between tracks is not supported
- Opus codec not supported on iOS
- POST request streaming requires `playFromData()` workaround