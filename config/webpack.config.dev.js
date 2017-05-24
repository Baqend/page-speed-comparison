var webpack = require('webpack');
var webpackMerge = require('webpack-merge');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var path = require("path");

var config = require('./webpack.config.base.js');

module.exports = webpackMerge(config, {
  devtool: "#inline-source-map",

  devServer: {
    port: 3000,
    contentBase: path.join(__dirname, 'dist'),
    compress: true
  },

  plugins: [
    new ExtractTextPlugin({
      filename: "css/[hash].css",
      disable: true
    })
  ]
});
