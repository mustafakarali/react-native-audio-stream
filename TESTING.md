# Testing Guide & Known Limitations

## ⚠️ Important Notice

This package is a comprehensive implementation but **has not been fully tested in production environments**. Before using in production, thorough testing is required.

## Testing Requirements

### Platform Testing
- [ ] iOS 13.0+ devices
- [ ] Android API 23+ devices
- [ ] React Native 0.76, 0.77, 0.78, 0.79, 0.80

### Core Functionality Testing
- [ ] Audio streaming initialization
- [ ] HTTP/HTTPS stream playback
- [ ] WebSocket stream support
- [ ] Play/Pause/Stop controls
- [ ] Seek functionality
- [ ] Volume control
- [ ] Playback rate adjustment

### Buffer Management Testing
- [ ] Initial buffering behavior
- [ ] Re-buffering on poor network
- [ ] Buffer size configuration
- [ ] Memory usage monitoring

### Network Resilience Testing
- [ ] Network interruption recovery
- [ ] Automatic reconnection
- [ ] Low bandwidth handling
- [ ] Timeout behavior

### Format Testing
- [ ] MP3 streams
- [ ] AAC streams
- [ ] WAV streams
- [ ] OGG streams
- [ ] Various bitrates (64kbps - 320kbps)
- [ ] Various sample rates

### Platform-Specific Testing

#### iOS
- [ ] Background audio playback
- [ ] Audio session interruptions
- [ ] AirPlay support
- [ ] Control Center integration
- [ ] Phone call interruptions

#### Android
- [ ] Background service
- [ ] Audio focus management
- [ ] Bluetooth headphone switching
- [ ] Notification controls
- [ ] Battery optimization impact

### Edge Cases
- [ ] App backgrounding/foregrounding
- [ ] Memory pressure scenarios
- [ ] Rapid play/pause cycles
- [ ] Multiple stream switching
- [ ] Very long streams (>1 hour)
- [ ] Concurrent audio apps

## Known Limitations

### General
1. **New Architecture Support**: Partial support for React Native's new architecture (Turbo Modules/Fabric)
2. **Equalizer on Android**: Basic implementation, may need AudioEffect API integration
3. **WebSocket Streaming**: Theoretical implementation, needs real-world testing
4. **Cache Management**: Basic implementation, may need optimization for large files

### iOS Specific
1. **iOS Simulator**: Audio streaming may not work correctly on simulator
2. **Codec Support**: Limited by iOS system codecs

### Android Specific
1. **Older Devices**: Performance may vary on Android < API 23
2. **Manufacturer Differences**: Audio handling varies by manufacturer

## Testing Checklist

### Unit Tests Needed
```typescript
// Example test structure needed
describe('AudioStream', () => {
  it('should initialize successfully', async () => {
    await expect(AudioStream.initialize()).resolves.toBeTruthy();
  });
  
  it('should handle stream start', async () => {
    await AudioStream.initialize();
    await expect(AudioStream.startStream(testUrl)).resolves.toBeTruthy();
  });
  
  // Add more tests...
});
```

### Manual Testing Steps

1. **Basic Playback**
   ```typescript
   // Test basic streaming
   await AudioStream.initialize();
   await AudioStream.startStream('https://example.com/test.mp3');
   ```

2. **Network Interruption**
   - Start stream
   - Turn off WiFi/cellular
   - Wait 5 seconds
   - Turn on network
   - Verify automatic recovery

3. **Background Playback**
   - Start stream
   - Press home button
   - Verify audio continues
   - Return to app
   - Verify controls still work

4. **Memory Testing**
   - Use Xcode Instruments (iOS) or Android Profiler
   - Stream for 30+ minutes
   - Monitor memory usage
   - Check for leaks

## Performance Benchmarks Needed

- Stream start latency: Target < 2 seconds
- Buffer recovery time: Target < 3 seconds
- Memory usage: Target < 50MB for normal streams
- CPU usage: Target < 10% during playback

## Recommended Testing Tools

### iOS
- Xcode Instruments for performance
- Console.app for logs
- Network Link Conditioner for network testing

### Android
- Android Studio Profiler
- ADB logcat for debugging
- Charles Proxy for network debugging

## Before Production Use

1. Complete all testing checkpoints
2. Test with your specific audio sources
3. Implement proper error handling
4. Add analytics for monitoring
5. Test on wide range of devices
6. Consider beta testing phase

## Contributing Test Results

If you test this package, please contribute your findings:
1. Device tested
2. OS version
3. React Native version
4. Test scenario
5. Results (pass/fail/issues)

Submit via GitHub issues or pull requests. 