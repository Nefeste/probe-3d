// Metro — как у Expo; плюс people.bin — ресурс сборки (src/load.ts).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bin');

module.exports = config;
