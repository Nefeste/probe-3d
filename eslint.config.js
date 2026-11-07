// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist-web/*', 'public/*', 'src/art/hall.gen.ts', 'src/people/bake.ts'] },
]);
