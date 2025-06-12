#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

const run = (cmd, cwd = root) => {
  console.log(`Running: ${cmd}`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to run: ${cmd}`);
    process.exit(1);
  }
};

console.log('🚀 Bootstrapping React Native Audio Stream...\n');

// Install root dependencies
console.log('📦 Installing root dependencies...');
run('yarn install');

// Build TypeScript
console.log('\n🔨 Building TypeScript...');
run('yarn typescript');

// Install example dependencies
console.log('\n📱 Setting up example app...');
run('yarn install', path.join(root, 'example'));

// Pod install for iOS
if (process.platform === 'darwin') {
  console.log('\n🍎 Installing iOS pods...');
  run('pod install', path.join(root, 'example', 'ios'));
}

console.log('\n✅ Bootstrap complete!');
console.log('\nTo run the example app:');
console.log('  iOS:     yarn example ios');
console.log('  Android: yarn example android'); 