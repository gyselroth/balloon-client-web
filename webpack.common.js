const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const MergeJsonWebpackPlugin = require('merge-jsons-webpack-plugin');
const GitRevisionPlugin = require('git-revision-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const {GenerateSW} = require('workbox-webpack-plugin');
var gitRevisionPlugin = new GitRevisionPlugin();

var isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: {
    balloon: './main.js',
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].[contenthash].js',
  },
  mode: isDev ? 'development' : 'production',
  devtool: isDev ? 'source-map' : false,
  module: {
    rules: [
      {
        test    : /\.(png|jpg|svg|gif|eot|woff|woff2|ttf)$/,
        loader  : 'url-loader?limit=30000&name=assets/[name].[hash].[ext]'
      },
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"]
          }
        }
      },
      /*{
        test: /(\.jsx|\.js)$/,
        loader: 'eslint-loader',
        exclude: /node_modules/
      },*/
      {
        test: /\.scss$/,
        use: [
          {
            loader: isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          },
          {
            loader: "css-loader",
            options: {
              minimize: true,
              sourceMap: isDev
            }
          },
          {
            loader: "sass-loader",
            options: {
              outputStyle: "compressed",
              sourceMap: isDev
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
    }),
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
      chunkFilename: "[name].[id].css"
    }),
    new HtmlWebpackPlugin({
      hash: true,
      filename: 'index.html',
      template: 'index.html',
      inject: false,
      minify: {
        collapseWhitespace: true,
        preserveLineBreaks: false,
      }
    }),
    new WebpackPwaManifest({
      name: 'balloon',
      short_name: 'balloon',
      description: 'Client for balloon',
      background_color: '#F4F4F4',
      theme_color: '#1E8EED',
      crossorigin: null,
      orientation: 'portrait-primary',
      display: 'fullscreen',
      ios: {
        'apple-mobile-web-app-status-bar-style': 'black',
      },
      publicPath: null,
      start_url: '/',
      icons: [
        {
          src: 'src/themes/default/img/icon_512x512.png',
          sizes: [96, 128, 192, 256, 384, 512],
          ios: true
        }
      ]
    }),
    new GenerateSW({
      importWorkboxFrom: 'local',
      clientsClaim: true,
      skipWaiting: true
    }),
    new webpack.DefinePlugin({
      'process.env.VERSION': JSON.stringify(process.env.VERSION || gitRevisionPlugin.version()),
      'process.env.COMMITHASH': JSON.stringify(gitRevisionPlugin.commithash()),
      'process.env.BRANCH': JSON.stringify(gitRevisionPlugin.branch()),
    }),
    new MergeJsonWebpackPlugin({
      "output": {
        "groupBy": [
          {
            "pattern": "{./locale/en.json,./app/*/locale/en.json}",
            "fileName": "locale/en.json"
          },
          {
            "pattern": "{./locale/de.json,./app/*/locale/de.json}",
            "fileName": "locale/de.json"
          }
        ]
      },
      "globOptions": {
        "nosort": true
      }
    })
  ]
};
