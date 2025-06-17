# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.6] - 2024-12-29

### Fixed
- Fixed Android build error: corrected `DefaultBandwidthMeter` import path from `androidx.media3.datasource` to `androidx.media3.exoplayer.upstream`
- This fixes compatibility with Media3 package structure where `DefaultBandwidthMeter` is located in the `upstream` package

## [1.10.5] - 2024-12-29

### Fixed
- **Critical Android Build Fix**: Removed phantom MemoryDataSource import that wasn't in source but appeared in npm package
- Fixed Base64 import: removed java.util.Base64 (requires API 26+) in favor of android.util.Base64
- Removed conflicting androidx.media3.common.AudioAttributes import
- Cleaned up all remaining ExoPlayer2 references
- Ensured clean build before npm publish

### Technical Details
- Fixed inconsistency between local source and npm published package
- Proper Base64 support for API 23+ devices
- AudioAttributes now properly uses android.media version for audio focus
- Complete Media3 migration is fully functional

## [1.10.4] - 2024-12-29

### Changed
- **BREAKING CHANGE**: Migrated from ExoPlayer2 to AndroidX Media3
  - All ExoPlayer2 dependencies replaced with AndroidX Media3 equivalents
  - Improved performance and better future support
  - No API changes - all methods remain the same
  - Smaller APK size with modular dependencies

### Technical Details
- Updated Android dependencies:
  - `com.google.android.exoplayer2:*:2.19.1` → `androidx.media3:*:1.2.0`
  - All imports updated to use `androidx.media3` packages
  - Using Media3's modular architecture for better optimization

### Notes
- This is a major internal change but maintains full backward compatibility
- Media3 is the new home of ExoPlayer and receives all new features
- Better integration with AndroidX ecosystem

## [1.10.3] - 2024-12-29

### Fixed
- Fixed Android build error: removed MemoryDataSource import that was causing compilation failures

## [1.10.2] - 2024-12-28

### Fixed
- This version was skipped

## [1.10.1] - 2024-12-28

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

## [1.9.0] - 2025-01-20

### Added
- 🎯 **Real-Time Chunk Streaming**: New `appendToBuffer()` method for true streaming
- Progressive audio playback - starts playing as soon as enough data is buffered
- Chunk-based streaming support for low latency TTS applications
- Optimized buffer management for real-time audio streaming

### Technical Details
- iOS: Uses NSMutableData buffer with progressive AVAsset loading
- Android: Temporary file with append mode and progressive MediaSource
- Automatic playback triggering when prebuffer threshold is reached
- Memory-efficient chunk processing without loading entire audio

### Use Cases
- Real-time TTS streaming from ElevenLabs, Deepgram, etc.
- Live audio streaming with minimal latency
- Progressive audio download and playback
- Memory-efficient handling of large audio files

### Example
```typescript
// Start empty stream
await AudioStream.startStream('', { autoPlay: true });

// Stream chunks as they arrive
const response = await fetch(ttsUrl);
const reader = response.body?.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(value)));
  await AudioStream.appendToBuffer(base64Chunk);
}
```

## [1.8.0] - 2025-01-20

### Added
- 🚀 **POST Request Support**: Full HTTP POST support for `startStream()` method
- Support for POST body (both string and object formats)
- Automatic JSON serialization for object bodies
- Direct TTS service integration without proxy servers
- Works with ElevenLabs, Deepgram, and other TTS APIs

### Technical Details
- iOS: Uses NSMutableURLRequest with HTTPMethod and HTTPBody
- Android: Custom DataSource with DataSpec for POST requests
- Supports custom headers with POST requests
- Automatic Content-Type detection for JSON bodies

### Use Cases
- Direct TTS streaming from services requiring POST requests
- API endpoints that need request bodies
- Authentication tokens in POST body
- Complex query parameters via POST

### Example
```typescript
await AudioStream.startStream('https://api.elevenlabs.io/v1/text-to-speech/voice-id/stream', {
  method: 'POST',
  headers: {
    'xi-api-key': 'your-api-key',
    'Content-Type': 'application/json',
  },
  body: {
    text: 'Hello world',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5,
    },
  },
  autoPlay: true,
});
```

## [1.7.0] - 2025-01-20

### Added
- 🎵 **Binary Data Playback**: New `playFromData()` method for both iOS and Android
- Support for base64 encoded audio data playback
- Full TTS (Text-to-Speech) service integration support
- Examples for ElevenLabs, Deepgram, and Minimax TTS services

### Technical Details
- iOS: Utilizes existing internal playFromData method, now exposed to public API
- Android: Creates temporary file from base64 data and plays using ExoPlayer
- Supports all audio formats that the platform can decode (MP3, AAC, WAV, etc.)

### Use Cases
- Direct playback of TTS service responses
- Playing audio from API responses without URL
- Offline audio playback from stored base64 data
- Reduced latency by avoiding URL redirects

## [1.6.6] - 2025-01-20

### Fixed
- 🚨 **Critical Android Build Fix**: Fixed "reference to reject is ambiguous" compilation errors
- Fixed ambiguous method calls by explicitly casting null to (Throwable) in promise.reject calls
- Affected methods: requestAudioFocus, showInputPicker, enableSpatialAudio, createRoutePickerView

### Technical Details
- Java compiler couldn't determine which overloaded reject method to use with null parameter
- Cast null to (Throwable) to explicitly specify the method signature

## [1.6.5] - 2025-01-20

### Fixed
- 🚨 **Critical iOS Crash Fix**: Fixed potential crash in getMetadata when creation date string is less than 4 characters
- 🔧 **iOS Optimization**: Removed unnecessary AVKit import (only AVFoundation needed for audio)

### Security
- Added safe string length check before substring operations in metadata extraction

## [1.6.4] - 2025-01-20

### Fixed
- 🚨 **PlaybackStats Interface**: Added missing fields (bufferedPosition, currentPosition, bufferedPercentage, isBuffering, playWhenReady)
- 🚨 **applyEqualizerPreset**: Now accepts both EqualizerPreset object and index number for backward compatibility
- 🚨 **Event Callbacks**: Fixed onNetworkStateChange to pass state object with isConnected and optional type
- 🚨 **iOS Native Methods**: Implemented missing getStats, getMetadata, and getEqualizer methods
- 🚨 **Documentation**: Corrected iOS 26 references to "iOS (Future)" as iOS 26 doesn't exist

### Added
- 🎵 **Equalizer Presets**: Added missing presets (Pop, Jazz, Dance, Classical) to match documentation
- 📊 **iOS Stats Implementation**: Full PlaybackStats support on iOS platform
- 🎵 **iOS Metadata**: Proper metadata extraction from AVAsset

### Changed
- Updated React Native compatibility table to reflect actual RN 0.80 release
- Improved error handling in iOS native methods
- Better TypeScript type safety with union types

## [1.6.3] - 2025-01-20

### Fixed
- 🚨 **Critical iOS Build Fix**: Commented out non-existent SDK types (AVInputPickerInteraction, AVRoutePickerView)
- Fixed "Property with 'retain (or strong)' attribute must be of object type" error
- Fixed "Unknown type name 'AVInputPickerInteraction'" error
- Removed all references to unavailable iOS SDK types in property declarations

## [1.6.2] - 2025-01-20

### Fixed
- 🚨 **Critical iOS Build Fix**: Commented out non-existent SDK types (AVInputPickerInteraction, AVRoutePickerView)
- Fixed "Property with 'retain (or strong)' attribute must be of object type" error
- Fixed "Unknown type name 'AVInputPickerInteraction'" error
- Removed all references to unavailable iOS SDK types

## [1.6.1] - 2025-01-20

### Fixed
- 🚨 **Critical iOS Fix**: Removed iOS 26.0 version check that was preventing code execution
- 🚨 **Critical Build Fix**: Commented out AVInputPickerInteraction usage as it doesn't exist in current iOS SDK
- 🚨 **Android 15 Compatibility**: Added proper audio focus checks for foreground/service requirements
- Fixed platform parity by adding placeholder methods to Android for iOS 26 features

### Added
- Android methods for iOS compatibility: showInputPicker, getAvailableInputs, enableEnhancedBuffering, enableSpatialAudio, useQueuePlayer, createRoutePickerView
- Basic available inputs detection for Android (built-in mic, wired headset)
- Audio focus change event handling with proper state management
- Foreground/service detection for Android 15 audio focus requirements

### Changed
- All iOS 26 features now return "UNSUPPORTED" error until APIs become available
- Improved error messages to indicate feature availability status

## [1.6.0] - 2025-01-20

### Added
- 🎙️ **iOS 26 Features Support**
  - AVInputPickerInteraction for native input device selection
  - AirPods high-quality recording support (placeholder for future API)
  - Spatial audio support with head tracking
  - AVQueuePlayer integration for enhanced buffering
  - Route picker view creation
  - Available input devices listing
- 📍 **Enhanced Audio Configuration**
  - `enableRecording` option for recording support
  - `voiceProcessing` option for voice chat mode
  - `spokenAudio` option for podcasts/audiobooks
  - `longFormAudio` option for long-form audio routing policy
  - `enableAirPodsHighQuality` option for future AirPods features
  - `enableEnhancedBuffering` option for AirPlay 2
  - `enableSpatialAudio` option for spatial audio
- 🚀 **New Methods**
  - `showInputPicker()` - Show native input device picker
  - `getAvailableInputs()` - Get list of available input devices
  - `enableEnhancedBuffering()` - Control AirPlay 2 enhanced buffering
  - `enableSpatialAudio()` - Control spatial audio support
  - `useQueuePlayer()` - Switch to AVQueuePlayer
  - `createRoutePickerView()` - Create native route picker view

### Changed
- Updated README with iOS 26 features documentation
- Enhanced Info.plist requirements with AVInitialRouteSharingPolicy
- Improved audio session configuration with iOS 26 optimizations

### Technical Details
- Added AVKit import for AVInputPickerInteraction
- Implemented iOS 26 API availability checks
- Enhanced audio session setup with routing policies
- Added spatial audio format configuration

## [1.5.3] - 2025-01-20

### Fixed
- iOS 18.5 OSStatus error -50 fix with completely rewritten audio session initialization
- Added retry mechanism for audio session activation (up to 3 attempts)
- Improved error handling with progressive fallback strategy
- Enhanced logging for better debugging

### Added
- `enableRecording` configuration option to properly set AVAudioSessionCategoryPlayAndRecord
- `voiceProcessing` configuration option for voice chat mode
- iOS 18+ specific optimizations and compatibility improvements
- Automatic session deactivation before configuration for clean state

### Changed
- Audio session category is now dynamically determined based on usage requirements
- Mode is set before category activation (iOS 18 requirement)
- Options are built incrementally with proper fallback mechanisms
- Better separation between playback-only and recording configurations

## [1.5.2] - 2025-01-19

### Fixed
- 🐛 **iOS OSStatus -50 Error**: Fixed paramErr in AVAudioSession configuration
- 🔧 **Safer Audio Session Setup**: Progressive setup with fallback options
- 📱 **iOS Compatibility**: Removed problematic audio session options
- ✅ **Robust Error Handling**: Better fallback when options fail
- 📝 **Enhanced Logging**: Added success logs for debugging

### Changed
- 🎯 **Audio Session Strategy**: Set category first, then try with options
- 🔄 **Fallback Mechanism**: Automatically fallback to basic setup if options fail
- 🚫 **Removed Options**: Removed AirPlay and BluetoothA2DP options that cause conflicts

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
- Added internal helper methods `play` and `