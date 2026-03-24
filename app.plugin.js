/**
 * Expo Config Plugin entry point for react-native-audio-stream.
 *
 * Usage in app.json / app.config.js:
 *
 * {
 *   "plugins": [
 *     ["@mustafakarali/react-native-audio-stream", {
 *       "enableBackgroundAudio": true,
 *       "enableForegroundService": true
 *     }]
 *   ]
 * }
 */
module.exports = require('./plugin/build/index').default;
