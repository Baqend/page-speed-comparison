var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var path = require("path");

module.exports = {
  entry: {
    main: path.resolve(__dirname, "../src/js/main.js")
  },

  output: {
    path: path.resolve(__dirname, "../dist"),
    filename: "js/[name].[hash].js"
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['es2015']
          }
        }
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: [
            {
              loader: "css-loader",
              options: {
                sourceMap: true
              }
            },
            {
              loader: "sass-loader",
              options: {
                sourceMap: true
              }
            }
          ],
          fallback: "style-loader"
        })
      },
      {
        test: /\.hbs$/,
        loader: 'handlebars-loader',
        query: {
          inlineRequires: 'img',
          partialDirs: [
            path.resolve(__dirname, '../src', 'templates', 'components'),
            path.resolve(__dirname, '../src', 'templates', 'layout')
          ]
        }
      },
      {
        test: /\.(gif|png|jpe?g|svg)$/i,
        use: [
          {
            loader: 'file-loader',
            query: {
              name: 'img/[name].[ext]'
            }
          }
        ]
      }
    ]
  },

  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery'
    }),
    new ExtractTextPlugin({
      filename: "css/[hash].css",
      disable: true
    }),
    new HtmlWebpackPlugin({
      title: 'Home',
      filename: 'index.html',
      template: 'src/templates/layout/default.hbs',
      chunks: ['vendor', 'main']
    }),
    new webpack.optimize.CommonsChunkPlugin({
      names: ['vendor']
    })
  ]
};
