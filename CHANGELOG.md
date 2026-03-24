# Changelog

All notable changes to `react-native-audio-stream` will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-22

### Added
- **React Hooks API**: Introduced `useAudioStream` and `useStreamProgress` for declarative, modern React component integration.
- **Expo Config Plugin**: Out-of-the-box support for `npx expo prebuild` with automated iOS `UIBackgroundModes` (audio) and Android `FOREGROUND_SERVICE` permissions.
- **Lock Screen Controls**: Full native integration with `MPNowPlayingInfoCenter` and `MPRemoteCommandCenter` on iOS, and `MediaSessionService` on Android.
- **Hardware Equalizer**: Replaced Android mock with real `android.media.audiofx.Equalizer` and exposed 5-band control. iOS continues to utilize `AVAudioUnitEQ`.
- **Stream Preloading**: True disk caching on Android using Media3 `CacheWriter` and asynchronous `AVURLAsset` loading on iOS.
- **Real-Time Stats**: iOS `getStats` latency and bitrate are now pulled from `AVPlayerItem.accessLog` arrays rather than returning static placeholders.

### Changed
- **BREAKING**: Minimum React Native version is now `0.76.0` (with React 18.3/19) utilizing the New Architecture natively via `install_modules_dependencies`.
- **BREAKING**: Android backend upgraded to AndroidX Media3 `1.10.0`. Minimum SDK is now `24` with Java 17 compile requirement.
- **BREAKING**: iOS deployment target raised to `16.0`.
- **BREAKING**: Calling `stopStream()` no longer silently purges all active event subscribers; developers must manage their own component lifecycles or use the new hooks.
- **Architecture**: Typescript interface upgraded to strict mode and ES2022 standards. The codebase has been radically sanitized to eliminate all "mock" endpoints.

### Fixed
- **iOS Streaming Issue #1**: Fixed the long-standing bug where infinite continuous streams (like radio URLs) would never play on iOS due to `NSURLSession` relying on `completionHandler:` instead of chunked delegates.
- **Android Race Conditions**: Fixed a critical `startStream` race condition where the Promise resolved prior to the `ExoPlayer` instance being fully allocated on the main thread.
- **Concurrency Setup**: iOS `startPlayback` now constructs unique `UUID` tmp files rather than static strings preventing multi-stream file locking.
- **Listener Leaks**: Resolved severe native-event listener multiplication when spamming `playFromData` or `startRealtimeStream`.

## [1.10.21] - 2023-11-05
- *Historical releases are preserved in git tags.*