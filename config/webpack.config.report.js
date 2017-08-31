var webpack = require('webpack');
var webpackMerge = require('webpack-merge');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var CleanWebpackPlugin = require('clean-webpack-plugin');

var config = require('./webpack.config.base.js');

module.exports = webpackMerge(config, {
  plugins: [
    new CleanWebpackPlugin(['dist'], {
      verbose: true
    }),
    new ExtractTextPlugin({
      filename: "css/[hash].css"
    }),
    new webpack.DefinePlugin({
      APP: '""',
      REPORT_PAGE: true
    })
  ]
});
