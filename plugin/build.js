/**
 * Simple build script for the Expo config plugin.
 * Transpiles TypeScript to JavaScript for use by Expo CLI.
 * Gracefully skips if expo is not installed (it's an optional peer dependency).
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if expo/config-plugins is available
try {
  require.resolve('expo/config-plugins');
} catch (e) {
  console.log('Expo not installed — skipping plugin build (expo is an optional peer dependency).');
  process.exit(0);
}

const pluginDir = path.resolve(__dirname);
const buildDir = path.join(pluginDir, 'build');

// Create build directory
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

try {
  execSync(
    `npx tsc --project ${path.join(pluginDir, 'tsconfig.json')}`,
    { stdio: 'inherit', cwd: pluginDir }
  );
  console.log('Plugin built successfully.');
} catch (error) {
  console.error('Plugin build failed:', error.message);
  process.exit(1);
}
