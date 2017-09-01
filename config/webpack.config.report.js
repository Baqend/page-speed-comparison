const { DefinePlugin } = require('webpack');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CleanWebpackPlugin = require('clean-webpack-plugin');
const config = require('./webpack.config.base.js');

module.exports = config(({ rootDir, distDir }) => ({
  plugins: [
    new CleanWebpackPlugin([distDir], {
      root: rootDir,
      verbose: true,
    }),
    new ExtractTextPlugin({
      filename: "css/[name].[hash].css",
    }),
    new DefinePlugin({
      APP: '""',
      REPORT_PAGE: true,
    }),
  ],
}));
