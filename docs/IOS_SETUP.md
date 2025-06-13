# iOS Setup Guide

This guide covers iOS-specific setup and configuration for React Native Audio Stream.

## Requirements

- iOS 13.0 or higher
- Xcode 13 or higher
- React Native 0.76+ (tested with 0.80)

## Installation

### 1. Install the package

```bash
npm install @mustafakarali/react-native-audio-stream
# or
yarn add @mustafakarali/react-native-audio-stream
```

### 2. Install iOS dependencies

```bash
cd ios && pod install
```

### 3. Configure Info.plist

Add the following keys to your `ios/YourApp/Info.plist`:

```xml
<!-- Enable background audio -->
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>

<!-- Allow HTTP connections (if needed) -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### 4. Background Audio Setup

For background audio playback, ensure your app has the proper audio session configuration:

```swift
// This is handled automatically by the library, but you can verify in AppDelegate.m
#import <AVFoundation/AVFoundation.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // ... existing code ...
  
  // Optional: Set audio session category
  [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];
  [[AVAudioSession sharedInstance] setActive:YES error:nil];
  
  return YES;
}
```

## Common Issues and Solutions

### 1. Audio stops when app goes to background

**Solution**: Ensure `UIBackgroundModes` includes `audio` in Info.plist and initialize with:
```javascript
AudioStream.initialize({
  enableBackgroundMode: true,
});
```

### 2. No sound output

**Solution**: Check audio session category and ensure device is not in silent mode:
```javascript
await AudioStream.setAudioSessionCategory('playback');
```

### 3. Build errors after pod install

**Solution**:
```bash
cd ios
pod deintegrate
pod install
# Clean build folder in Xcode: Cmd+Shift+K
```

### 4. Simulator issues

Note: Audio streaming may have limitations on iOS Simulator. Always test on real devices for accurate behavior.

### 5. Bluetooth/AirPlay support

The library automatically enables Bluetooth and AirPlay when background mode is enabled. No additional configuration needed.

## iOS-Specific Features

### Audio Session Management

```javascript
// Set audio session category
await AudioStream.setAudioSessionCategory('playback'); // or 'ambient', 'soloAmbient'

// Request audio focus
const granted = await AudioStream.requestAudioFocus();

// Abandon audio focus
await AudioStream.abandonAudioFocus();
```

### Interruption Handling

The library automatically handles:
- Phone calls
- Siri activation
- Other app audio interruptions
- Headphone plug/unplug events

### Now Playing Info (Lock Screen)

Currently not implemented but planned for future releases. You can use `react-native-music-control` alongside this library for lock screen controls.

## Performance Tips

1. **Buffer Configuration**: For iOS, smaller buffers work well due to efficient system audio handling:
   ```javascript
   AudioStream.initialize({
     bufferSize: 32,  // 32KB works well on iOS
     prebufferThreshold: 16,
   });
   ```

2. **Network Configuration**: iOS handles network efficiently, but you can optimize:
   ```javascript
   AudioStream.initialize({
     timeout: 30000,  // 30 seconds
     reconnectAttempts: 3,
   });
   ```

## Testing Checklist

- [ ] Audio plays in foreground
- [ ] Audio continues in background
- [ ] Audio resumes after interruption (phone call)
- [ ] Audio pauses when headphones disconnected
- [ ] Audio routes to Bluetooth/AirPlay correctly
- [ ] Memory usage is stable during long playback
- [ ] Network reconnection works properly

## Debugging

Enable verbose logging:
```javascript
AudioStream.initialize({
  logLevel: 'DEBUG',
});
```

Check Xcode console for native logs prefixed with `[RNAudioStream]`.

## Known Limitations

1. Lock screen controls not yet implemented
2. Gapless playback between tracks not supported
3. Opus codec not supported on iOS

## Need Help?

- Check the [examples](../examples/) folder
- Report issues on [GitHub](https://github.com/mustafakarali/react-native-audio-stream/issues)
- Email: mustafa@birharika.com 