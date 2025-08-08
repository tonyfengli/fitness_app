const { getDefaultConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Resolve node_modules from workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Add support for shared packages
config.resolver.extraNodeModules = {
  '@acme/api': path.resolve(workspaceRoot, 'packages/api'),
  '@acme/auth': path.resolve(workspaceRoot, 'packages/auth'),
  '@acme/db': path.resolve(workspaceRoot, 'packages/db'),
  '@acme/ui-shared': path.resolve(workspaceRoot, 'packages/ui-shared'),
  '@acme/validators': path.resolve(workspaceRoot, 'packages/validators'),
};

module.exports = config;