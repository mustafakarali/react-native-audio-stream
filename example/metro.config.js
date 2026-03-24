const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch only the library src/ directory (not entire workspace — Windows watcher limit)
config.watchFolders = [path.resolve(workspaceRoot, 'src')];

// Resolve from project root + workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force resolving react-native to example's node_modules
config.resolver.disableHierarchicalLookup = true;

// Windows file watcher workaround
config.watcher = {
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000,
    filePrefix: '.metro-health-check',
  },
  watchman: {
    deferStates: ['hg.update'],
  },
};

module.exports = config;
