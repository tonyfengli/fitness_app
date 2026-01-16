const { getDefaultConfig } = require('@react-native/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Monorepo-friendly
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Watch workspace for dependencies
const workspaceRoot = path.resolve(__dirname, '../..');
config.watchFolders = [workspaceRoot];

// Keep the existing node_modules resolution
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Add extraNodeModules for packages that need explicit resolution
config.resolver.extraNodeModules = {
  'react-native-vector-icons': path.resolve(workspaceRoot, 'node_modules/react-native-vector-icons'),
  'react-native-fs': path.resolve(workspaceRoot, 'node_modules/react-native-fs'),
};

// Make sure @babel/runtime resolves correctly
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@babel/runtime')) {
    return {
      filePath: require.resolve(moduleName, { paths: [workspaceRoot] }),
      type: 'sourceFile',
    };
  }
  
  
  // Let Metro handle other modules
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;