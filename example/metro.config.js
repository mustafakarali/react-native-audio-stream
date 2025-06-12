const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Path to the local package
const packagePath = path.resolve(__dirname, '..');

const config = {
  watchFolders: [packagePath],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(packagePath, 'node_modules'),
    ],
    extraNodeModules: {
      'react-native-audio-stream': packagePath,
    },
  },
};

module.exports = mergeConfig(defaultConfig, config); 