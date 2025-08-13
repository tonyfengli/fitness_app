module.exports = function (api) {
  api.cache(true);
  
  const plugins = [
    'nativewind/babel',
    ['module:react-native-dotenv', {
      moduleName: '@env',
      path: '.env',
      safe: false,
      allowUndefined: true,
      verbose: false,
    }],
  ];
  
  // Always add reanimated plugin last
  plugins.push('react-native-reanimated/plugin');
  
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};