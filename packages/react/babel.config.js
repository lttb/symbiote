module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        loose: true,
        targets: '> 1%, not IE 11, not dead',
      },
    ],
    '@babel/preset-react',
  ],
  plugins: ['@babel/plugin-proposal-class-properties'],
};
