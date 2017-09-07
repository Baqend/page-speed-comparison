const { ProvidePlugin, optimize: { CommonsChunkPlugin } } = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackMd5Hash = require('webpack-md5-hash');
const webpackMerge = require('webpack-merge');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'src');
const tmplDir = path.resolve(srcDir, 'templates');
const distDir = path.resolve(rootDir, 'dist');

module.exports = (config) => webpackMerge({
  entry: {
    vendor: ['jquery', 'bootstrap', 'whatwg-fetch', 'baqend/realtime'],
    app: path.resolve(srcDir, 'js'),
  },

  output: {
    path: distDir,
    filename: 'js/[name].[chunkhash].js',
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'awesome-typescript-loader',
        options: {
          transpileOnly: true,
        },
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: [
            {
              loader: 'css-loader',
              options: { sourceMap: true },
            },
            {
              loader: 'sass-loader',
              options: { sourceMap: true },
            },
          ],
          fallback: 'style-loader',
        }),
      },
      {
        test: /\.hbs$/,
        loader: 'handlebars-loader',
        query: {
          inlineRequires: /^\..*img/,
          partialDirs: [
            path.resolve(tmplDir, 'components'),
            path.resolve(tmplDir, 'layout'),
          ],
        },
      },
      {
        test: /\.(gif|png|jpe?g|svg|ico)$/ig,
        loader: 'file-loader',
        query: {
          name: 'img/[name].[ext]',
        },
      },
    ],
  },

  plugins: [
    new WebpackMd5Hash(),
    new ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
    }),
    new ExtractTextPlugin({
      filename: 'css/[name].[hash].css',
      disable: true,
    }),
    new HtmlWebpackPlugin({
      title: 'Page Speed Analyzer',
      filename: 'index.html',
      template: path.resolve(tmplDir, 'layout', 'default.hbs'),
      chunks: ['vendor', 'app'],
    }),
    new CommonsChunkPlugin({
      name: 'vendor',
      minChunks: Infinity,
    }),
  ],
}, config({ rootDir, srcDir, distDir, tmplDir }));
