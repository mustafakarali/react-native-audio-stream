# Contributing to React Native Audio Stream

Thank you for your interest in contributing to React Native Audio Stream! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/react-native-audio-stream.git
   cd react-native-audio-stream
   ```
3. Install dependencies:
   ```bash
   yarn install
   ```
4. Set up the example app:
   ```bash
   cd example
   yarn install
   cd ios && pod install
   ```

## Development Workflow

1. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test them in the example app:
   ```bash
   # Run iOS
   yarn example ios
   
   # Run Android
   yarn example android
   ```

3. Run tests and linting:
   ```bash
   yarn test
   yarn lint
   yarn typescript
   ```

4. Commit your changes following the commit message guidelines

5. Push your branch and create a pull request

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or modifications
- `chore:` Build process or auxiliary tool changes

Example:
```
feat: add WebSocket streaming support

- Implement WebSocket protocol handler
- Add reconnection logic
- Update documentation
```

## Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Run `yarn lint` to check for linting errors
- Run `yarn prettier` to format your code

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Test on both iOS and Android platforms
- Test different audio formats and network conditions

## Pull Request Process

1. Ensure your PR description clearly describes the problem and solution
2. Include any relevant issue numbers
3. Update the README.md if needed
4. Add tests for new functionality
5. Ensure all checks pass
6. Request review from maintainers

## Reporting Issues

When reporting issues, please include:

- Device information (iOS/Android version, device model)
- React Native version
- Library version
- Steps to reproduce
- Expected vs actual behavior
- Any error messages or logs

## Development Tips

### iOS Development

- Use Xcode for native iOS debugging
- Check Console.app for detailed logs
- Test on real devices for audio performance

### Android Development

- Use Android Studio for native debugging
- Use `adb logcat` for detailed logs
- Test on various Android versions

### Testing Audio Streams

Test with various audio sources:
- HTTP/HTTPS streams
- Different audio formats (MP3, AAC, etc.)
- Live streams vs static files
- Different bitrates and sample rates

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for contributing! 🎉 