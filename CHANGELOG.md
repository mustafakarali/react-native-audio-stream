# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of react-native-audio-stream
- Real-time audio streaming support for iOS and Android
- TypeScript support with full type definitions
- Comprehensive playback controls (play, pause, stop, seek)
- Volume and playback rate control
- Buffer management with configurable size
- Network resilience with automatic reconnection
- Multiple audio format support (MP3, AAC, WAV, OGG)
- 5-band equalizer with presets
- Background playback capability
- Audio focus management
- Caching mechanism for offline playback
- Event-driven architecture with callbacks
- Detailed playback statistics
- Metadata extraction
- HTTP/HTTPS streaming support
- React Native 0.76-0.80 compatibility

### Security
- Secure handling of stream URLs and headers
- Proper permission management for audio playback

### Known Issues
- WebSocket streaming needs testing
- Android equalizer implementation is basic
- New architecture (Turbo Modules) support is partial
- Package has not been tested in production 

## [1.5.1] - 2024-01-14

### Fixed
- 🐛 **iOS Audio Session Error**: Fixed `NSOSStatusErrorDomain` initialization error
- 🔧 **Type Fixes**: AVAudioSessionCategory now uses string literal correctly
- 📝 **Better Error Logging**: Added detailed NSLog for debugging audio session issues
- ✅ **Nil Safety**: Added nil checks for config dictionary
- 🎯 **Config Initialization**: Initialize config as empty dictionary in init

## [1.5.0] - 2024-01-14

### 🚀 Major iOS Overhaul

#### Fixed
- 🐛 **Duplicate Method Error**: Removed duplicate `cancelStream:rejecter:` declaration
- 🐛 **Enum Error**: Fixed `AVErrorFormatNotSupported` → `AVErrorFormatUnsupported`
- 🔧 **Observer Management**: Proper observer lifecycle with dedicated add/remove methods
- 💾 **Memory Management**: Added timeObserver property with proper cleanup

#### Added
- ⚡ **Modern AVPlayer Implementation**: Replaced NSTimer with `addPeriodicTimeObserverForInterval`
- 🎯 **Auto-Initialize**: Streams can now auto-initialize if not manually initialized
- 🔍 **Centralized Observer Management**: `addObserversToPlayerItem` / `removeObservers` methods
- 🎬 **Dedicated Adaptive Streaming**: `startAdaptiveStreamFromURL` for HLS/DASH
- 🛡️ **Enhanced Error Handling**: `setupAudioSessionWithError` with proper error propagation

#### Improved
- 📐 **Code Architecture**: Complete restructure with modern Objective-C patterns
- 🧵 **Thread Safety**: Proper dispatch_async usage for UI operations
- 🧹 **Code Cleanup**: Removed redundant code and improved readability
- 🎛️ **Professional Implementation**: Production-ready code quality

## [1.4.3] - 2024-01-14

### Documentation
- 📚 **README Overhaul**: Fixed all inconsistencies and missing information
- 📋 Updated version compatibility table to reflect current versions
- 🎵 Added PCM and FLAC to supported formats list
- 🌐 Added onNetworkStateChange event documentation
- 📊 Updated PlaybackStats interface with all new fields
- ❗ Added comprehensive error codes table
- 🎛️ Documented equalizer presets with indices
- 🎬 Added dedicated HLS/DASH streaming section
- 💡 Clarified that initialize() is optional
- 🔄 Enhanced examples with metadata and cancelStream usage

## [1.4.2] - 2024-01-14

### Added
- 🍎 **iOS Enhancements**: Complete feature parity with Android
- 📝 Error log notification handler for better debugging
- 🔧 CoreMedia and MediaPlayer framework imports
- 🎯 Improved memory management in playFromData

### Fixed
- 🍎 Fixed playFromData to properly clean up existing observers
- 🍎 Fixed startPlayback to not call play prematurely
- 🍎 Enhanced cancelStream with proper cleanup sequence
- 🍎 Better player state management

### Improved
- 🚀 iOS now has complete feature parity with Android
- 📊 Better error logging with AVPlayerItemErrorLog
- 🔍 More robust observer management
- 💾 Improved memory management patterns

## [1.4.1] - 2024-01-14

### Fixed
- 🍎 **iOS Build Error**: Fixed missing `play` and `pause` internal methods
- 🍎 **Duplicate KVO Method**: Removed duplicate `observeValueForKeyPath` implementation
- 🍎 **React Native 0.79 Compatibility**: Fixed build errors for RN 0.79

### Technical Changes
- Added internal helper methods `play` and `pause` for iOS
- Cleaned up KVO implementation
- Fixed method visibility issues

## [1.4.0] - 2024-01-14

### Added
- 🎬 **Full HLS/DASH Support**: Proper implementation for both Android and iOS with native player support
- 🎵 **PCM and FLAC Support**: Added support for PCM and FLAC audio formats
- 🔧 **Enhanced Error Handling**: Detailed error codes and recovery options with retry functionality
- 📊 **Improved Metadata Support**: Better metadata extraction and display
- 🐛 **Fixed cancelStream**: Now properly cancels stream and sets state to IDLE on both platforms
- 📈 **Enhanced Stream Info**: Added network speed and buffer health to stream info display
- 🚨 **Detailed Error Logging**: More comprehensive error information in logs and alerts
- 🔍 **KVO Implementation**: Added proper Key-Value Observing for iOS player status

### Fixed
- 🐛 Fixed CMake build errors for new architecture (Android)
- 🐛 Fixed cancelStream implementation on both platforms
- 🐛 Fixed HLS buffering issues - now uses native player support
- 🐛 Fixed metadata not displaying properly
- 🐛 Fixed background mode warning
- 🐛 Fixed error recovery flow with proper retry mechanism
- 🐛 Fixed iOS observer pattern for player item status

### Improved
- 🚀 HLS streams now use native player support for better performance
- 📱 Better error recovery with retry options in alerts
- 🎯 More accurate buffer percentage for live streams
- 📊 Enhanced demo app with better error handling
- 🌐 Better protocol detection (HLS, DASH, MP3, etc.)
- 📝 More detailed error messages with error codes

### Technical Changes
- Added `extractAndSendMetadata` method for iOS
- Improved `handlePlayerError` and `handleStreamError` methods
- Added HLS-specific player configuration
- Enhanced error code mapping for both platforms

## [1.3.9] - 2024-01-14

### Added
- ✨ `cancelStream()` method for immediate stream cancellation
- 📊 Buffer events history tracking in demo app
- 🎛️ Advanced stream controls (network priority, playback rate) in demo app
- 🌐 Network status monitoring with real-time indicators
- 📈 Enhanced stream info display (protocol detection, latency, played/buffered duration)
- 🎚️ Dynamic playback speed control with visual feedback
- 📝 Helper functions for stream type detection and byte formatting
- 🎵 Additional test streams (BBC Radio 1, HLS test stream)

### Fixed
- 🐛 Fixed undefined `cancelStream` error in TypeScript
- 🐛 Added missing `cancelStream` to IAudioStream and NativeModule interfaces

### Improved
- 🚀 Better HLS/DASH stream support
- 📱 Enhanced demo app with more comprehensive buffer statistics
- 🎨 Improved UI with better visual feedback for buffer states

## [1.3.8] - 2024-01-13

### Added
- 🎬 HLS/DASH adaptive streaming support
- 📊 Live stream buffer percentage calculation (30-second window)
- 🔧 Media source detection for .m3u8 and .mpd files

### Fixed
- 🐛 Fixed buffer percentage for live streams without duration
- 🐛 Fixed background mode toggle error

### Improved
- 📈 Better buffer statistics visualization
- 🎯 Enhanced error recovery for live streams

## [1.3.7] - 2024-01-13

### Added
- ☕ Buy Me a Coffee support integration
- 💰 Support badges and links in documentation

## [1.3.6] - 2024-01-13

### Added
- ❌ `cancelStream` method for both Android and iOS
- 📊 Detailed buffer statistics in demo app
- 🎯 Real-time buffer monitoring with chunk visualization

### Fixed
- 🐛 Fixed NativeEventEmitter warnings
- 🐛 Fixed cache size calculation (now shows used space)
- 🐛 Fixed buffer percentage calculation

### Improved
- 🎨 Enhanced demo app UI with buffer visualization
- 📱 Better error state recovery

## [1.3.5] - 2024-01-12

### Fixed
- 🐛 Fixed React Native 0.80 compatibility issues
- 🐛 Fixed codegenConfig for New Architecture support

## [1.3.4] - 2024-01-12

### Added
- 🏗️ React Native 0.80 New Architecture support
- 🔧 TurboModule and Fabric compatibility

## [1.3.3] - 2024-01-11

### Fixed
- 🐛 Fixed cancel/stopStream state (now sets to IDLE)
- 🐛 Fixed buffer percentage calculation
- 🐛 Fixed cache size display
- 🐛 Added LoadControl for better buffering

### Added
- 🎛️ Background mode toggle in demo UI
- 📊 Detailed buffer statistics

## [1.3.2] - 2024-01-10

### Fixed
- 🍎 Critical iOS fixes:
  - Fixed CMTime crashes with validation checks
  - Fixed KVO observer safety
  - Enhanced audio session configuration
  - Added codegenConfig for RN compatibility

## [1.3.1] - 2024-01-10

### Fixed
- 🍎 iOS Podspec name correction
- 🍎 Fixed folly_compiler_flags undefined error
- 🍎 Added missing pod dependencies

## [1.3.0] - 2024-01-09

### Added
- 📱 Comprehensive BufferDemo example app
- 📊 Real-time buffer visualization
- 🎯 Stream health monitoring
- 📚 Detailed documentation and examples

## [1.2.2] - 2024-01-08

### Fixed
- 🔧 Thread safety improvements
- 🐛 Android build fixes

## [1.2.1] - 2024-01-08

### Fixed
- 🐛 Additional Android compatibility fixes

## [1.2.0] - 2024-01-08

### Added
- 🎯 Major feature updates
- 📊 Enhanced statistics
- 🔧 Improved error handling

## [1.1.0] - 2024-01-07

### Added
- ✨ New streaming features
- 📱 Platform-specific enhancements

## [1.0.4] - 2024-01-06

### Fixed
- 🐛 Android build issues

## [1.0.3] - 2024-01-06

### Fixed
- 🐛 Additional Android fixes

## [1.0.2] - 2024-01-06

### Fixed
- 🐛 Android namespace issues
- 🐛 Gradle configuration fixes

## [1.0.1] - 2024-01-06

### Fixed
- 🐛 TypeScript build errors
- 🐛 Android compatibility issues

## [1.0.0] - 2024-01-06

### Added
- 🎉 Initial release
- 🎵 Real-time audio streaming
- 📱 iOS and Android support
- 🔧 TypeScript support
- 🎛️ Advanced playback controls
- 📊 Statistics and monitoring
- 🎚️ Equalizer support
- 💾 Smart caching
- 🔄 Network resilience
- 🎯 Background playback 