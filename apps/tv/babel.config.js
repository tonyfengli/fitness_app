module.exports = function (api) {
  api.cache(true);

  const plugins = [
    'nativewind/babel',
    // Required for zod/v4 ES module syntax used by @acme/validators
    '@babel/plugin-transform-export-namespace-from',
  ];

  // Always add reanimated plugin last
  plugins.push('react-native-reanimated/plugin');

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};