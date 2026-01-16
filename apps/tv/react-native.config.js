const path = require('path');

module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
  },
  dependencies: {
    // Fix for monorepo module resolution
    ...(process.env.NO_FLIPPER
      ? {'react-native-flipper': {platforms: {ios: null}}}
      : {}),
    // Explicitly configure react-native-fs for monorepo autolinking
    'react-native-fs': {
      root: path.resolve(__dirname, '../../node_modules/react-native-fs'),
    },
  },
  // Help Metro find packages in monorepo
  watchFolders: [
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, '../../packages'),
  ],
};