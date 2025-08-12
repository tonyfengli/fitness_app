module.exports = function (api) {
  api.cache(true);
  
  const plugins = ['nativewind/babel'];
  
  // Always add reanimated plugin last
  plugins.push('react-native-reanimated/plugin');
  
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};