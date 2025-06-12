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