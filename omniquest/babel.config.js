module.exports = function (api) {
  api.cache(true)

  return {
    plugins: ['./scripts/babel-plugin-localize-ui-text.cjs'],
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  }
}