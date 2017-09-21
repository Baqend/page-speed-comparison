const { DefinePlugin } = require('webpack');
const BaqendPlugin = require('baqend-webpack-plugin');
const config = require('./webpack.config.base.js');

module.exports = config(({ distDir }) => ({
  devtool: 'inline-source-map',

  devServer: {
    port: 3000,
    disableHostCheck: true,
    contentBase: distDir,
    compress: true,
  },

  plugins: [
    new DefinePlugin({
      APP: '"makefast-dev"',
      REPORT_PAGE: false,
    }),

    new BaqendPlugin({ app: 'makefast-dev', codeDir: 'baqend' }),
  ],
}));
