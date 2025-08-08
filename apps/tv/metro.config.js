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

// Create a proxy for resolving node_modules
const nodeModulesProxy = new Proxy({}, {
  get: (target, name) => {
    const modulePath = path.join(workspaceRoot, 'node_modules', name);
    return modulePath;
  }
});

// Add support for shared packages and dependencies
config.resolver.extraNodeModules = new Proxy({}, {
  get: (target, name) => {
    // First check if it's a workspace package
    if (name.startsWith('@acme/')) {
      const packageName = name.replace('@acme/', '');
      return path.resolve(workspaceRoot, 'packages', packageName);
    }
    // Otherwise resolve from root node_modules
    return path.resolve(workspaceRoot, 'node_modules', name);
  }
});

module.exports = config;