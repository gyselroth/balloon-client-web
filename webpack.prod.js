const merge = require('webpack-merge');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const common = require('./webpack.common.js');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');

common.plugins.unshift(
  new FaviconsWebpackPlugin({
    logo: './themes/default/img/icon_blue.svg',
    prefix: 'icons-[hash]/',
    emitStats: false,
    statsFilename: 'iconstats-[hash].json',
    persistentCache: true,
    inject: true,
    background: 'transparent',
    title: 'balloon web ui',
    icons: {
      android: true,
      appleIcon: true,
      appleStartup: true,
      coast: false,
      favicons: true,
      firefox: true,
      opengraph: true,
      twitter: false,
      yandex: false,
      windows: true
    }
  })
);

module.exports = common;
