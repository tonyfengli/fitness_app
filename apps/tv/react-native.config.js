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
  },
  commands: [
    {
      name: 'log',
      func: () => {
        console.log('Custom command');
      },
    },
  ],
};