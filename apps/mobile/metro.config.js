const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const contractsSrc = path.resolve(__dirname, '../../packages/contracts/src');

// @vastu/contracts is NodeNext source: './http.js' means './http.ts'. Metro does not know that.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    context.originModulePath.startsWith(contractsSrc)
  ) {
    return context.resolveRequest(context, moduleName.slice(0, -3), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
