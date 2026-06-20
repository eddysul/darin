const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('svg');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');

module.exports = withNativeWind(config, { input: './global.css', darkMode: 'class' });
